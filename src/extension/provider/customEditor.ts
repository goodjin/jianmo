import * as vscode from 'vscode';
import * as path from 'path';
import type { DocumentStore } from '@core/documentStore';
import type { ModeController } from '@core/modeController';
import type { ExtensionConfig, HostDiagnostics, WebViewMessage, ExtensionMessage, EditorMode } from '@types';
import { registerWebview, unregisterWebview } from '../commands';
import { showExportFailureWithDiagnostics } from '@extension/export/exportFailureUi';
import { exportToPdf, pdfExportOptionsFromPdfConfig } from '@core/export/pdfExport';
import { exportToHtml } from '@core/export/htmlExport';
import { checkLocalMarkdownImageRefs, resolveMarkdownImageUri, toMarkdownImageRelativePath } from './imagePaths';
import { findMarkdownBacklinksForDocument } from '../markdown/findMarkdownBacklinks';
import { computeMarkdownHoverPreview } from '../markdown/markdownHoverPreview';
import { summarizeViaProvider } from '@extension/ai/summarize';
import { suggestTitlesViaProvider } from '@extension/ai/suggestTitles';
import { textToGfmTableViaProvider } from '@extension/ai/textToGfmTable';
import { rewriteSelectionViaProvider } from '@extension/ai/rewriteSelection';
import { withExportRetry } from '@extension/export/exportRetry';
import type { ImageSameNameHandling } from '@extension/image/imageFilenameCollision';
import { pickNonConflictingFilenameAsync } from '@extension/image/imageFilenameCollision';
import { confirmContinueAfterExportPreflight } from '@extension/export/exportPreflightUi';
import {
  buildInlinePreviewHtmlForCustomWebview,
  showExportHtmlPreviewPanel,
} from '@extension/preview/exportHtmlPreview';
import { getExportFilters } from './exportFilters';
import {
  classifyExportDocumentIntent,
  classifyOpenExternalNavigationTarget,
} from './webviewInboundRouting';

// M283：协议兼容层 PoC（第一步：握手/诊断字段）
const EXT_PROTOCOL_VERSION = 1;
const EXT_MIN_SUPPORTED_PROTOCOL_VERSION = 1;

function isMarkdownFileUriAllowedInWorkspace(openUri: vscode.Uri): boolean {
  if (openUri.scheme !== 'file') return false;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return false;
  const fp = path.normalize(openUri.fsPath);
  for (const f of folders) {
    const base = path.normalize(f.uri.fsPath);
    const prefix = base.endsWith(path.sep) ? base : base + path.sep;
    if (process.platform === 'win32') {
      const fl = fp.toLowerCase();
      if (fl === base.toLowerCase() || fl.startsWith(prefix.toLowerCase())) return true;
    } else if (fp === base || fp.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export class MarkdownEditorProvider implements vscode.CustomEditorProvider {
  private readonly webviews = new Map<string, vscode.WebviewPanel>();
  private readonly documentVersions = new Map<string, number>();
  private changeDocumentListener: vscode.Disposable | null = null;
  private changeDisposable: vscode.Disposable | null = null;
  private _listeners: Set<(e: vscode.CustomDocumentEditEvent<vscode.CustomDocument>) => void> | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly documentStore: DocumentStore,
    private config: ExtensionConfig,
    private readonly modeController: ModeController
  ) {}

  private static readonly LAST_MODE_BY_URI_STATE_KEY = 'markly.editorModeByDocumentUri';

  private readLastModesMap(): Record<string, string> {
    return (
      this.context.workspaceState.get<Record<string, string>>(
        MarkdownEditorProvider.LAST_MODE_BY_URI_STATE_KEY
      ) ?? {}
    );
  }

  private persistLastEditorMode(uriStr: string, mode: EditorMode): void {
    const next = { ...this.readLastModesMap(), [uriStr]: mode };
    void this.context.workspaceState.update(MarkdownEditorProvider.LAST_MODE_BY_URI_STATE_KEY, next);
  }

  private resolveInitialEditorMode(uriStr: string): EditorMode {
    const policy = vscode.workspace.getConfiguration('markly').get<string>('editor.openMode', 'remember');
    if (policy === 'rich' || policy === 'source' || policy === 'preview') {
      return policy;
    }
    if (policy !== 'remember') {
      return 'rich';
    }
    const last = this.readLastModesMap()[uriStr];
    if (last === 'rich' || last === 'source' || last === 'preview') return last as EditorMode;
    return 'rich';
  }

  private buildHostDiagnostics(): HostDiagnostics {
    // 注意：这里不包含任何 workspace 路径（避免泄露用户信息）
    const editor = this.config.editor;
    return {
      vscodeVersion: String(vscode.version || ''),
      extensionVersion: String((this.context.extension.packageJSON as any)?.version ?? ''),
      platform: process.platform,
      arch: process.arch,
      configSnapshot: {
        theme: editor.theme,
        fontSize: editor.fontSize,
        wrapPolicy: editor.wrapPolicy,
        tableCellWrap: editor.tableCellWrap,
        enableMermaid: editor.enableMermaid,
        enableShiki: editor.enableShiki,
      },
    };
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    console.log('openCustomDocument called for:', uri.toString());
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString('utf-8');
      console.log('File read successfully, length:', text.length);

      // 初始化版本号
      const initialVersion = openContext.backupId ? parseInt(openContext.backupId, 10) : 1;
      this.documentVersions.set(uri.toString(), initialVersion);

      this.documentStore.setDocument(uri.toString(), {
        uri: uri.toString(),
        content: text,
        version: initialVersion,
        isDirty: false,
      });
      console.log('Document stored successfully');

      return {
        uri,
        dispose: () => {
          this.documentVersions.delete(uri.toString());
          this.documentStore.deleteDocument(uri.toString());
        },
      };
    } catch (error) {
      console.error('Error in openCustomDocument:', error);
      throw error;
    }
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log('resolveCustomEditor called for:', document.uri.toString());
    const uri = document.uri.toString();
    this.webviews.set(uri, webviewPanel);

    // 允许加载：扩展内静态资源 + 工作区 + 当前文档目录（本地截图 ![](./assets/…) 依赖后两者）
    const resourceRootSet = new Map<string, vscode.Uri>();
    const addRoot = (u: vscode.Uri) => resourceRootSet.set(u.toString(), u);
    addRoot(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'));
    addRoot(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'public'));
    addRoot(vscode.Uri.file(path.dirname(document.uri.fsPath)));
    for (const wf of vscode.workspace.workspaceFolders ?? []) {
      addRoot(wf.uri);
    }
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [...resourceRootSet.values()],
    };

    // 获取 WebView HTML
    webviewPanel.webview.html = this.getWebviewHtml(webviewPanel.webview);

    // 监听 WebView 消息
    webviewPanel.webview.onDidReceiveMessage(
      async (message: WebViewMessage) => {
        await this.handleWebviewMessage(uri, message);
      },
      null,
      this.context.subscriptions
    );

    // 注册 WebView 到命令系统
    registerWebview(uri, webviewPanel.webview);

    // 不在此阶段发 INIT：须等 Webview JS 挂载并发送 READY，否则首批消息可能在 message 监听注册前丢失，
    // 且无法在 payload 中填入 document 目录的 webview URI。

    // 监听文档变化
    this.changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === uri) {
        const doc = this.documentStore.getDocument(uri);
        if (doc) {
          // 更新版本号
          const currentVersion = this.documentVersions.get(uri) || 0;
          const newVersion = currentVersion + 1;
          this.documentVersions.set(uri, newVersion);

          doc.content = e.document.getText();
          this.postMessage(uri, {
            type: 'CONTENT_UPDATE',
            payload: { content: doc.content, version: newVersion },
          });
        }
      }
    });
    this.context.subscriptions.push(this.changeDisposable);

    // 监听 WebView 关闭 - 合并为一个监听器
    webviewPanel.onDidDispose(() => {
      this.webviews.delete(uri);
      unregisterWebview(uri);
      // 清理 documentVersions 防止内存泄漏
      this.documentVersions.delete(uri);
    });
  }

  private async handleWebviewMessage(
    uri: string,
    message: WebViewMessage
  ): Promise<void> {
    switch (message.type) {
      case 'READY':
        // WebView 准备就绪，发送初始内容（包括版本号）
        {
          const wvProtocol = message.protocolVersion ?? 0;
          const wvMin = message.minSupportedProtocolVersion ?? 0;
          const incompatible =
            wvMin > EXT_PROTOCOL_VERSION || wvProtocol < EXT_MIN_SUPPORTED_PROTOCOL_VERSION;
          if (incompatible) {
            const reason =
              wvMin > EXT_PROTOCOL_VERSION
                ? `Webview 需要更高协议（webview min=${wvMin}, ext=${EXT_PROTOCOL_VERSION}）`
                : `Webview 过旧（webview=${wvProtocol}, ext min=${EXT_MIN_SUPPORTED_PROTOCOL_VERSION}）`;
            void vscode.window.showErrorMessage(
              `Markly 协议不兼容，将自动降级到 Source。${reason}。建议 Reload Window 或升级扩展。`
            );
            // 体验优先：先确保可编辑（Source 兜底）
            this.postMessage(uri, { type: 'SWITCH_MODE', payload: { mode: 'source' } });
          }
        }
        {
          const initMsg = this.buildInitExtensionMessage(uri);
          if (initMsg) this.postMessage(uri, initMsg);
        }
        break;

      case 'CONTENT_CHANGE':
        // 版本号检查，避免循环更新
        const incomingVersion = message.payload.version;
        const currentVersion = this.documentVersions.get(uri) || 0;

        if (incomingVersion !== undefined && incomingVersion <= currentVersion) {
          // 忽略旧版本的更新
          break;
        }

        // 更新版本号
        this.documentVersions.set(uri, incomingVersion ?? currentVersion + 1);

        this.documentStore.updateContent(uri, message.payload.content);
        // 同步到文件
        await this.saveDocument(uri, message.payload.content);
        break;

      case 'SAVE_IMAGE': {
        const requestId = message.payload.requestId;
        const requested = message.payload.filename;
        const result = await this.saveImage(uri, message.payload.data, requested);
        if (result.ok) {
          this.postMessage(uri, {
            type: 'IMAGE_SAVED',
            payload: { path: result.path, filename: result.filename, requestId },
          });
        } else {
          this.postMessage(uri, {
            type: 'IMAGE_SAVE_FAILED',
            payload: { filename: requested, error: result.error, requestId },
          });
        }
        break;
      }

      case 'UPLOAD_IMAGE': {
        const requestId = message.payload.requestId;
        const requested = message.payload.filename;
        const result = await this.saveImage(uri, message.payload.base64, requested);
        if (result.ok) {
          this.postMessage(uri, {
            type: 'IMAGE_SAVED',
            payload: { path: result.path, filename: result.filename, requestId },
          });
        } else {
          this.postMessage(uri, {
            type: 'IMAGE_SAVE_FAILED',
            payload: { filename: requested, error: result.error, requestId },
          });
        }
        break;
      }

      case 'CHECK_LOCAL_IMAGE_REFS': {
        const results = await checkLocalMarkdownImageRefs(vscode.Uri.parse(uri), message.payload.refs);
        this.postMessage(uri, {
          type: 'LOCAL_IMAGE_REFS_RESULT',
          payload: { requestId: message.payload.requestId, results },
        });
        break;
      }

      case 'LIST_ASSETS_IMAGE_FILES': {
        const listings = await this.listAssetsDirectoryImageFiles(uri);
        this.postMessage(uri, {
          type: 'ASSETS_IMAGE_FILES_RESULT',
          payload: {
            requestId: message.payload.requestId,
            relativePaths: listings.paths,
            ...(listings.error ? { error: listings.error } : {}),
          },
        });
        break;
      }

      case 'DELETE_ASSETS_IMAGE_FILES': {
        const requestId = message.payload.requestId;
        const rels = Array.isArray(message.payload.relativePaths) ? message.payload.relativePaths : [];
        const relsUniq = Array.from(new Set(rels.map((x) => String(x ?? '').trim()).filter(Boolean)));

        if (relsUniq.length === 0) {
          this.postMessage(uri, {
            type: 'ASSETS_IMAGE_DELETE_RESULT',
            payload: { requestId, cancelled: false, deletedRelativePaths: [], failed: [] },
          } as ExtensionMessage);
          break;
        }

        const confirmed = await vscode.window.showWarningMessage(
          `将删除保存目录中的未引用图片 ${relsUniq.length} 个。此操作可从回收站恢复（若支持）。是否继续？`,
          { modal: true },
          '删除'
        );
        if (confirmed !== '删除') {
          this.postMessage(uri, {
            type: 'ASSETS_IMAGE_DELETE_RESULT',
            payload: { requestId, cancelled: true, deletedRelativePaths: [], failed: [] },
          } as ExtensionMessage);
          break;
        }

        const docUri = vscode.Uri.parse(uri);
        const docDirUri = vscode.Uri.joinPath(docUri, '..');
        const saveDirectory = String(this.config.image.saveDirectory || './assets').trim() || './assets';
        const assetsDirUri = vscode.Uri.joinPath(docDirUri, saveDirectory);

        const deletedRelativePaths: string[] = [];
        const failed: Array<{ relativePath: string; error: string }> = [];

        for (const rel of relsUniq) {
          try {
            const relPosix = rel.replace(/\\/g, '/');
            // 只允许删除 saveDirectory 下的一层文件：防止 `../` 越界与误删
            const norm = path.posix.normalize(relPosix);
            if (norm.includes('..')) throw new Error('路径非法（包含 ..）');
            const expectedPrefix = (saveDirectory.replace(/\\/g, '/').replace(/^\.\//, '') + '/').replace(/\/+$/, '/');
            const normalizedNoDot = norm.replace(/^\.\//, '');
            if (!normalizedNoDot.startsWith(expectedPrefix)) throw new Error('仅允许删除保存目录下的文件');
            const basename = path.posix.basename(normalizedNoDot);
            if (!basename || basename.includes('/')) throw new Error('仅允许删除保存目录一层内文件');

            const target = vscode.Uri.joinPath(assetsDirUri, basename);
            await vscode.workspace.fs.delete(target, { useTrash: true });
            deletedRelativePaths.push(rel);
          } catch (e) {
            failed.push({ relativePath: rel, error: String((e as Error)?.message ?? e ?? 'delete_failed') });
          }
        }

        this.postMessage(uri, {
          type: 'ASSETS_IMAGE_DELETE_RESULT',
          payload: { requestId, cancelled: false, deletedRelativePaths, failed },
        } as ExtensionMessage);
        break;
      }

      case 'FIND_MARKDOWN_BACKLINKS': {
        const requestId = message.payload.requestId;
        try {
          const docUri = vscode.Uri.parse(uri);
          const result = await findMarkdownBacklinksForDocument(docUri);
          this.postMessage(uri, {
            type: 'MARKDOWN_BACKLINKS_RESULT',
            payload: {
              requestId,
              items: result.items,
              ...(result.error ? { error: result.error } : {}),
              ...(result.truncated ? { truncated: true } : {}),
            },
          });
        } catch (err) {
          console.error('[M64] findMarkdownBacklinksForDocument failed', err);
          this.postMessage(uri, {
            type: 'MARKDOWN_BACKLINKS_RESULT',
            payload: { requestId, items: [] },
          });
        }
        break;
      }

      case 'OPEN_MARKDOWN_DOCUMENT': {
        const openUri = vscode.Uri.parse(message.payload.uri);
        if (!isMarkdownFileUriAllowedInWorkspace(openUri)) {
          void vscode.window.showWarningMessage('只能打开当前工作区内的 Markdown 文件。');
          break;
        }
        try {
          const td = await vscode.workspace.openTextDocument(openUri);
          await vscode.window.showTextDocument(td, { preview: true });
        } catch (err) {
          void vscode.window.showErrorMessage(`无法打开文件：${String((err as Error)?.message ?? err)}`);
        }
        break;
      }

      case 'MARKDOWN_HOVER_PREVIEW_REQUEST': {
        const requestId = message.payload.requestId;
        try {
          const docUri = vscode.Uri.parse(uri);
          const r = await computeMarkdownHoverPreview({ sourceDocumentUri: docUri, href: message.payload.href });
          this.postMessage(uri, {
            type: 'MARKDOWN_HOVER_PREVIEW_RESULT',
            payload: { requestId, ...r },
          });
        } catch (err) {
          console.error('[M65] MARKDOWN_HOVER_PREVIEW_REQUEST failed', err);
          this.postMessage(uri, {
            type: 'MARKDOWN_HOVER_PREVIEW_RESULT',
            payload: { requestId, ok: false, error: String((err as Error)?.message ?? err ?? 'failed') },
          });
        }
        break;
      }

      case 'OPEN_WORKSPACE_SEARCH': {
        const q = String(message.payload.query ?? '').trim();
        if (!q) break;
        try {
          await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: q,
            triggerSearch: true,
            isRegex: false,
            matchWholeWord: false,
            isCaseSensitive: false,
          });
        } catch (err) {
          console.error('[M68] OPEN_WORKSPACE_SEARCH failed', err);
        }
        break;
      }

      case 'OPEN_IMAGE_DIRECTORY': {
        await this.openImageDirectory(uri, message.payload);
        break;
      }

      case 'REPAIR_IMAGE_REF': {
        await this.repairImageRef(uri, message.payload.ref);
        break;
      }

      case 'OPEN_IMAGE_PREVIEW':
        // 处理图片预览 - 使用 VSCode 内置图片预览
        if (message.payload?.src) {
          const imageUri = resolveMarkdownImageUri(vscode.Uri.parse(uri), message.payload.src);
          if (imageUri) {
            await vscode.commands.executeCommand('vscode.openWith', imageUri, 'imagePreview.default');
          }
        }
        break;

      case 'OPEN_IMAGE_EDITOR':
        // 处理图片编辑 - 打开系统默认图片编辑器
        if (message.payload?.src) {
          const imageUri = resolveMarkdownImageUri(vscode.Uri.parse(uri), message.payload.src);
          if (imageUri) {
            await vscode.commands.executeCommand('editor.action.openImageEditor', imageUri);
          }
        }
        break;

      case 'OPEN_EXTERNAL_LINK': {
        const decided = classifyOpenExternalNavigationTarget((message as any).payload?.url);
        if (decided.action === 'open') {
          await vscode.env.openExternal(vscode.Uri.parse(decided.url));
        } else if (decided.reason === 'empty') {
          break;
        } else if (decided.reason === 'forbidden_scheme') {
          vscode.window.showWarningMessage('仅支持打开 http/https 链接。');
        } else {
          vscode.window.showWarningMessage('链接无效，无法打开。');
        }
        break;
      }

      case 'SAVE':
        // 处理保存 - 保存当前文档内容
        if (message.payload?.content !== undefined) {
          try {
            await this.saveDocument(uri, message.payload.content);
            const newVersion = (this.documentVersions.get(uri) || 0) + 1;
            this.documentVersions.set(uri, newVersion);
            this.documentStore.updateContent(uri, message.payload.content);
            this.postMessage(uri, {
              type: 'SAVE_SUCCESS',
              payload: { version: newVersion },
            });
          } catch (e) {
            const errMsg = String((e as Error)?.message ?? e ?? '写入失败');
            this.postMessage(uri, {
              type: 'SAVE_FAILED',
              payload: { error: errMsg },
            });
            void vscode.window.showErrorMessage(`保存失败：${errMsg}`);
          }
        }
        break;

      case 'EXPORT':
        // 处理导出 - 导出为不同格式
        await this.exportDocument(uri, message.payload);
        break;

      case 'AI_REWRITE_SELECTION_REQUEST': {
        const requestId = message.payload.requestId;
        const r = await rewriteSelectionViaProvider(message.payload.text, this.config, this.context);
        this.postMessage(uri, {
          type: 'AI_REWRITE_SELECTION_RESULT',
          payload: r.ok
            ? { requestId, ok: true, text: r.text }
            : { requestId, ok: false, error: r.error },
        });
        break;
      }

      case 'AI_SUMMARY_REQUEST': {
        const requestId = message.payload.requestId;
        const r = await summarizeViaProvider(
          { text: message.payload.text, scope: message.payload.scope },
          this.config,
          this.context
        );
        this.postMessage(uri, {
          type: 'AI_SUMMARY_RESULT',
          payload: r.ok ? { requestId, ok: true, text: r.text } : { requestId, ok: false, error: r.error },
        });
        break;
      }

      case 'AI_SUGGEST_TITLES_REQUEST': {
        const requestId = message.payload.requestId;
        const r = await suggestTitlesViaProvider(message.payload.text, this.config, this.context);
        this.postMessage(uri, {
          type: 'AI_SUGGEST_TITLES_RESULT',
          payload: r.ok
            ? { requestId, ok: true, items: r.items }
            : { requestId, ok: false, error: r.error },
        });
        break;
      }

      case 'AI_CONVERT_TEXT_TO_TABLE_REQUEST': {
        const requestId = message.payload.requestId;
        const r = await textToGfmTableViaProvider(message.payload.text, this.config, this.context);
        this.postMessage(uri, {
          type: 'AI_CONVERT_TEXT_TO_TABLE_RESULT',
          payload: r.ok ? { requestId, ok: true, markdown: r.markdown } : { requestId, ok: false, error: r.error },
        });
        break;
      }

      case 'TRACK_EDITOR_MODE': {
        const mode = message.payload.mode;
        this.persistLastEditorMode(uri, mode);
        this.modeController.setSyncedEditorMode(mode);
        break;
      }

      case 'REQUEST_PREVIEW_HTML': {
        const panel = this.webviews.get(uri);
        const docNow = this.documentStore.getDocument(uri);
        if (!panel || !docNow) break;
        const docUri = vscode.Uri.parse(uri);
        const cfg = vscode.workspace.getConfiguration('markly');
        const htmlThemeRaw = cfg.get<string>('export.html.theme', 'default');
        const htmlTheme = htmlThemeRaw === 'print-friendly' ? 'print-friendly' : 'default';
        const result = await buildInlinePreviewHtmlForCustomWebview(
          docNow.content,
          docUri,
          panel.webview,
          htmlTheme
        );
        if (result.error) {
          this.postMessage(uri, { type: 'PREVIEW_HTML', payload: { error: result.error } });
        } else {
          this.postMessage(uri, { type: 'PREVIEW_HTML', payload: { html: result.html } });
        }
        break;
      }

      case 'getScrollPosition':
        // 处理获取滚动位置的请求
        // WebView 会在另一侧处理此消息并返回响应
        // 这里不需要特殊处理，因为响应会通过 scrollPositionResponse 发送
        break;
    }

    // 转发消息给 ModeController 处理模式相关逻辑
    this.modeController.dispatchWebviewMessage(message);
  }

  /**
   * 处理来自 WebView 的滚动位置响应
   * 由 extension/index.ts 在收到消息时调用
   */
  public handleScrollPositionResponse(requestId: string, scrollTop: number, scrollLeft: number): void {
    // requestId 就是 URI，直接使用
    this.postMessage(requestId, {
      type: 'scrollPositionResponse',
      requestId,
      scrollTop,
      scrollLeft,
    });
  }

  private async saveDocument(uri: string, content: string): Promise<void> {
    const docUri = vscode.Uri.parse(uri);
    const buffer = Buffer.from(content, 'utf-8');
    await vscode.workspace.fs.writeFile(docUri, buffer);
  }

  /**
   * M53：枚举 `image.saveDirectory` 目录下一层的图片文件名，路径相对于文档所在目录（posix）。
   */
  private async listAssetsDirectoryImageFiles(documentUriStr: string): Promise<{ paths: string[]; error?: string }> {
    const imageSuffix = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
      '.bmp',
      '.tiff',
      '.tif',
      '.avif',
    ]);
    try {
      const docUri = vscode.Uri.parse(documentUriStr);
      const docDirUri = vscode.Uri.joinPath(docUri, '..');
      const saveDirectory = String(this.config.image.saveDirectory || './assets').trim() || './assets';
      const assetsDirUri = vscode.Uri.joinPath(docDirUri, saveDirectory);

      await vscode.workspace.fs.stat(assetsDirUri);

      const entries = await vscode.workspace.fs.readDirectory(assetsDirUri);
      const paths: string[] = [];
      for (const [name, kind] of entries) {
        if (kind !== vscode.FileType.File) continue;
        const low = name.toLowerCase();
        const dot = low.lastIndexOf('.');
        if (dot < 0 || !imageSuffix.has(low.slice(dot))) continue;
        const fileUri = vscode.Uri.joinPath(assetsDirUri, name);
        paths.push(path.relative(docDirUri.fsPath, fileUri.fsPath).replace(/\\/g, '/'));
      }
      paths.sort((a, b) => a.localeCompare(b));
      return { paths };
    } catch (e) {
      return { paths: [], error: String((e as Error)?.message ?? e ?? '读取保存目录失败') };
    }
  }

  private async assetBasenameExists(assetsDir: vscode.Uri, basename: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(assetsDir, basename));
      return true;
    } catch {
      return false;
    }
  }

  private async pickFinalImageBasename(
    assetsDir: vscode.Uri,
    requestedFilename: string,
    policy: ImageSameNameHandling
  ): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
    const conflicts = await this.assetBasenameExists(assetsDir, requestedFilename);
    if (!conflicts) return { ok: true, filename: requestedFilename };

    if (policy === 'overwrite') return { ok: true, filename: requestedFilename };

    if (policy === 'rename') {
      const picked = await pickNonConflictingFilenameAsync(requestedFilename, (name) =>
        this.assetBasenameExists(assetsDir, name)
      );
      return { ok: true, filename: picked };
    }

    const picked = await vscode.window.showQuickPick(
      ['覆盖已有文件', '自动重命名（推荐）', '取消'],
      { title: `图片文件名已存在：${requestedFilename}` }
    );
    if (!picked || picked === '取消') return { ok: false, error: '已取消保存（文件名冲突）。' };
    if (picked === '覆盖已有文件') return { ok: true, filename: requestedFilename };

    const next = await pickNonConflictingFilenameAsync(requestedFilename, (name) =>
      this.assetBasenameExists(assetsDir, name)
    );
    return { ok: true, filename: next };
  }

  private async saveImage(
    documentUri: string,
    data: string,
    requestedFilename: string
  ): Promise<{ ok: true; path: string; filename: string } | { ok: false; error: string }> {
    try {
      const basenameOnly = path.posix.basename(String(requestedFilename).replace(/\\/g, '/')) || 'image.png';

      const docUri = vscode.Uri.parse(documentUri);
      const docDir = vscode.Uri.joinPath(docUri, '..');
      const assetsDir = vscode.Uri.joinPath(docDir, this.config.image.saveDirectory);

      // 确保 assets 目录存在
      try {
        await vscode.workspace.fs.stat(assetsDir);
      } catch {
        await vscode.workspace.fs.createDirectory(assetsDir);
      }

      const policy = this.config.image.sameNameHandling;
      const resolved = await this.pickFinalImageBasename(assetsDir, basenameOnly, policy);
      if (!resolved.ok) return resolved;

      const finalFilename = resolved.filename.replace(/\\/g, '/').split('/').pop() ?? resolved.filename;

      // 解析 base64 数据
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const imagePath = vscode.Uri.joinPath(assetsDir, finalFilename);
      await vscode.workspace.fs.writeFile(imagePath, buffer);

      return { ok: true, filename: finalFilename, path: `${this.config.image.saveDirectory}/${finalFilename}` };
    } catch (error) {
      console.error('Failed to save image:', error);
      return { ok: false, error: String((error as any)?.message ?? error ?? 'Unknown image save error') };
    }
  }

  private async openImageDirectory(
    documentUri: string,
    payload: { kind: 'document' | 'assets' | 'resolved'; resolvedPath?: string }
  ): Promise<void> {
    const docUri = vscode.Uri.parse(documentUri);
    const docDir = vscode.Uri.joinPath(docUri, '..');
    const target =
      payload.kind === 'assets'
        ? vscode.Uri.joinPath(docDir, this.config.image.saveDirectory)
        : payload.kind === 'resolved' && payload.resolvedPath
          ? vscode.Uri.file(path.dirname(payload.resolvedPath))
          : docDir;
    await vscode.commands.executeCommand('revealFileInOS', target);
  }

  private async repairImageRef(documentUri: string, fromRef: string): Promise<void> {
    const docUri = vscode.Uri.parse(documentUri);
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
      },
    });
    const imageUri = selected?.[0];
    if (!imageUri) {
      this.postMessage(documentUri, {
        type: 'IMAGE_REF_REPAIR_OUTCOME',
        payload: { fromRef, status: 'cancelled' },
      } as ExtensionMessage);
      return;
    }
    const toRef = toMarkdownImageRelativePath(docUri, imageUri);
    this.postMessage(documentUri, {
      type: 'IMAGE_REF_REPLACEMENT',
      payload: { fromRef, toRef },
    });
    this.postMessage(documentUri, {
      type: 'IMAGE_REF_REPAIR_OUTCOME',
      payload: { fromRef, status: 'replaced' },
    } as ExtensionMessage);
  }

  private async exportDocument(uri: string, payload: any): Promise<void> {
    const doc = this.documentStore.getDocument(uri);
    const intent = classifyExportDocumentIntent(payload, doc);
    if (intent.kind === 'abort') {
      return;
    }

    const docUri = vscode.Uri.parse(uri);
    if (intent.kind === 'preview') {
      showExportHtmlPreviewPanel({
        markdown: intent.markdown,
        documentUri: docUri,
        htmlTheme: this.config.export.html?.theme ?? 'default',
        mermaidScriptBundling: this.config.export.diagram?.mermaidScriptBundling ?? 'embedded',
      });
      return;
    }

    const docForExport = doc!;
    // 显示保存对话框
    const defaultName = docUri.fsPath.replace(/\.\w+$/, `.${intent.format}`);
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.parse(defaultName),
      filters: getExportFilters(intent.format),
    });

    if (!saveUri) {
      return;
    }

    try {
      const pfScope = this.config.export.preflight?.scope ?? 'full';
      const pfBlock = this.config.export.preflight?.blockOnIssues === true;

      if (intent.format === 'html') {
        if (
          !(await confirmContinueAfterExportPreflight({
            markdown: docForExport.content,
            documentUri: docUri,
            scope: pfScope,
            blockOnIssues: pfBlock,
            formatLabel: 'HTML',
            remoteHttpsHostsAllowlist: this.config.image?.remoteHttpsHostsAllowlist,
          }))
        ) {
          return;
        }
        await withExportRetry(async () => {
          await exportToHtml(docForExport.content, saveUri.fsPath, {
            includeToc: true,
            title: docUri.fsPath.split(/[\\/]/).pop()?.replace(/\.\w+$/, '') || '导出文档',
            htmlTheme: this.config.export.html?.theme ?? 'default',
            copyLocalImages: this.config.export.html?.copyLocalImages === true,
            documentBaseDir: path.dirname(docUri.fsPath),
            assetsSubdirectory: this.config.export.html?.assetsSubdirectory ?? 'markly-html-assets',
            mermaidScriptBundling: this.config.export.diagram?.mermaidScriptBundling ?? 'embedded',
          });
        });
        vscode.window.showInformationMessage(`HTML 已导出: ${saveUri.fsPath}`);
        return;
      }

      if (intent.format === 'pdf') {
        if (
          !(await confirmContinueAfterExportPreflight({
            markdown: docForExport.content,
            documentUri: docUri,
            scope: pfScope,
            blockOnIssues: pfBlock,
            formatLabel: 'PDF',
            remoteHttpsHostsAllowlist: this.config.image?.remoteHttpsHostsAllowlist,
          }))
        ) {
          return;
        }
        const baseHref = vscode.Uri.file(path.dirname(docUri.fsPath)).toString(true) + '/';
        await withExportRetry(async () => {
          await exportToPdf(docForExport.content, saveUri.fsPath, {
            ...pdfExportOptionsFromPdfConfig(this.config.export.pdf, baseHref),
            mermaidScriptBundling: this.config.export.diagram?.mermaidScriptBundling ?? 'embedded',
          });
        });
        vscode.window.showInformationMessage(`PDF 已导出: ${saveUri.fsPath}`);
        return;
      }

      vscode.window.showWarningMessage(`暂不支持导出 ${intent.format}`);
    } catch (error) {
      const fmt = String(intent.format);
      if (fmt === 'pdf' || fmt === 'html') {
        void showExportFailureWithDiagnostics(this.context, fmt, error, {
          documentPath: docUri.fsPath,
          outputPath: saveUri.fsPath,
        });
      } else {
        vscode.window.showErrorMessage(
          `导出 ${fmt.toUpperCase()} 失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 当前文档所在目录的 webview URI（尾斜杠），供 Rich 内解析相对路径图片。
   */
  private computeDocumentFolderWebviewUri(documentUriStr: string): string | undefined {
    const panel = this.webviews.get(documentUriStr);
    if (!panel) return undefined;
    try {
      const docUri = vscode.Uri.parse(documentUriStr);
      const folderUri = vscode.Uri.file(path.dirname(docUri.fsPath));
      const href = panel.webview.asWebviewUri(folderUri).toString();
      return href.endsWith('/') ? href : `${href}/`;
    } catch {
      return undefined;
    }
  }

  /** INIT 单一路径：统一附带 documentFolderWebviewUri，避免各处重复拼 payload。 */
  private buildInitExtensionMessage(uri: string): ExtensionMessage | null {
    const doc = this.documentStore.getDocument(uri);
    const version = this.documentVersions.get(uri) || 1;
    if (!doc) return null;
    const documentFolderWebviewUri = this.computeDocumentFolderWebviewUri(uri);
    const initialEditorMode = this.resolveInitialEditorMode(uri);
    return {
      type: 'INIT',
      payload: {
        content: doc.content,
        config: this.config,
        version,
        hostDiagnostics: this.buildHostDiagnostics(),
        ...(documentFolderWebviewUri ? { documentFolderWebviewUri } : {}),
        initialEditorMode,
      },
    };
  }

  postMessage(uri: string, message: ExtensionMessage): void {
    const webview = this.webviews.get(uri);
    if (webview) {
      webview.webview.postMessage({
        ...message,
        protocolVersion: EXT_PROTOCOL_VERSION,
        minSupportedProtocolVersion: EXT_MIN_SUPPORTED_PROTOCOL_VERSION,
      });
    }
  }

  notifyConfigChange(config: ExtensionConfig): void {
    this.config = config;
    this.webviews.forEach((_webview, uri) => {
      this.postMessage(uri, { type: 'CONFIG_CHANGE', payload: { config } });
    });
  }

  // VSCode CustomEditorProvider 接口实现
  async saveCustomDocument(
    document: vscode.CustomDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.toString();
    const doc = this.documentStore.getDocument(uri);
    if (doc) {
      await this.saveDocument(uri, doc.content);
    }
  }

  async saveCustomDocumentAs(
    document: vscode.CustomDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.toString();
    const doc = this.documentStore.getDocument(uri);
    if (doc) {
      const buffer = Buffer.from(doc.content, 'utf-8');
      await vscode.workspace.fs.writeFile(destination, buffer);
    }
  }

  async revertCustomDocument(
    document: vscode.CustomDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.toString();
    const content = await vscode.workspace.fs.readFile(document.uri);
    const text = Buffer.from(content).toString('utf-8');
    this.documentStore.updateContent(uri, text);
    const version = (this.documentVersions.get(uri) || 0) + 1;
    this.documentVersions.set(uri, version);
    this.postMessage(uri, {
      type: 'CONTENT_UPDATE',
      payload: { content: text, version },
    });
  }

  async backupCustomDocument(
    document: vscode.CustomDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const uri = document.uri.toString();
    const doc = this.documentStore.getDocument(uri);
    if (doc) {
      const buffer = Buffer.from(doc.content, 'utf-8');
      await vscode.workspace.fs.writeFile(context.destination, buffer);
    }
    return {
      id: (this.documentVersions.get(uri) || 1).toString(),
      delete: async () => {
        // 备份由 VSCode 管理
      },
    };
  }

  get onDidChangeCustomDocument(): vscode.Event<vscode.CustomDocumentEditEvent<vscode.CustomDocument>> {
    // 使用缓存避免重复创建监听器
    if (!this.changeDocumentListener) {
      this.changeDocumentListener = vscode.workspace.onDidChangeTextDocument((e) => {
        const uri = e.document.uri.toString();
        const doc = this.documentStore.getDocument(uri);
        if (doc) {
          const newVersion = (this.documentVersions.get(uri) || 0) + 1;
          this.documentVersions.set(uri, newVersion);
          // 创建自定义文档事件
          const customDoc = { uri: e.document.uri, dispose: () => {} };
          // 通知所有订阅者
          this._listeners?.forEach((listener) => {
            listener({
              document: customDoc,
              undo: () => {},
              redo: () => {},
            });
          });
        }
      });
    }
    return (listener: (e: vscode.CustomDocumentEditEvent<vscode.CustomDocument>) => void) => {
      if (!this._listeners) {
        this._listeners = new Set();
      }
      this._listeners.add(listener);
      return {
        dispose: () => {
          this._listeners?.delete(listener);
        },
      };
    };
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.css')
    );
    console.log('getWebviewHtml - scriptUri:', scriptUri.toString());
    console.log('getWebviewHtml - styleUri:', styleUri.toString());

    // M296：收紧 Webview CSP（仅允许扩展自身脚本；避免 https 外链 script / unsafe-eval）
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data: blob:`,
      `script-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource} https: data:`,
      `connect-src ${webview.cspSource} https:`,
      `base-uri 'none'`,
      `frame-ancestors 'none'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    /* VSCode 默认样式 */
    :root {
      --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --vscode-font-size: 13px;
      --vscode-editor-font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      --vscode-editor-font-size: 14px;
      --vscode-editor-background: #1e1e1e;
      --vscode-editor-foreground: #d4d4d4;
      --vscode-editor-selectionBackground: #264f78;
      --vscode-editorWidget-background: #252526;
      --vscode-editorWidget-border: #454545;
      --vscode-foreground: #cccccc;
      --vscode-descriptionForeground: #858585;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
      --vscode-button-hoverBackground: #1177bb;
      --vscode-toolbar-hoverBackground: #5a5a5a;
      --vscode-toolbar-activeBackground: #6e6e6e;
      --vscode-focusBorder: #007fd4;
      --vscode-scrollbarSlider-background: rgba(121, 121, 121, 0.4);
      --vscode-scrollbarSlider-hoverBackground: rgba(100, 100, 100, 0.5);
      --vscode-textCodeBlock-background: #2d2d2d;
      --vscode-textBlockQuote-border: #007acc;
      --vscode-textBlockQuote-foreground: #858585;
      --vscode-editor-inactiveSelectionBackground: #3a3d41;
      --vscode-keybindingLabel-background: rgba(128, 128, 128, 0.17);
      --vscode-keybindingLabel-border: rgba(51, 51, 51, 0.6);
    }

    @media (prefers-color-scheme: light) {
      :root {
        --vscode-editor-background: #ffffff;
        --vscode-editor-foreground: #333333;
        --vscode-editor-selectionBackground: #add6ff;
        --vscode-editorWidget-background: #f3f3f3;
        --vscode-editorWidget-border: #c8c8c8;
        --vscode-foreground: #333333;
        --vscode-descriptionForeground: #717171;
        --vscode-button-background: #0078d4;
        --vscode-button-hoverBackground: #006cbd;
        --vscode-toolbar-hoverBackground: rgba(0, 0, 0, 0.08);
        --vscode-toolbar-activeBackground: rgba(0, 0, 0, 0.12);
        --vscode-scrollbarSlider-background: rgba(100, 100, 100, 0.4);
        --vscode-scrollbarSlider-hoverBackground: rgba(100, 100, 100, 0.6);
        --vscode-textCodeBlock-background: #f2f2f2;
        --vscode-editor-inactiveSelectionBackground: #e5e5e5;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      width: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    #app {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
  </style>
  <title>Markly</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" crossorigin src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.webviews.forEach((webview) => webview.dispose());
    this.webviews.clear();
    // 清理 documentVersions
    this.documentVersions.clear();
    // 清理 changeDocumentListener
    this.changeDocumentListener?.dispose();
    this.changeDocumentListener = null;
    // 清理 changeDisposable
    this.changeDisposable?.dispose();
    this.changeDisposable = null;
    // 清理 _listeners
    this._listeners?.clear();
    this._listeners = null;
  }
}
