import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ModeController } from '@core/modeController';
import type { DocumentStore } from '@core/documentStore';
import type { ExtensionMessage, PdfConfig, RichTableCommandValue } from '@types';
import { exportToPdf, pdfExportOptionsFromPdfConfig } from '@core/export/pdfExport';
import { exportToHtml } from '@core/export/htmlExport';
import { toMarkdownImageRelativePath } from '@extension/provider/imagePaths';
import { confirmContinueAfterExportPreflight } from '@extension/export/exportPreflightUi';
import { runCopyLastExportFailureDiagnostics, showExportFailureWithDiagnostics } from '@extension/export/exportFailureUi';
import { showExportHtmlPreviewPanel } from '@extension/preview/exportHtmlPreview';
import { clearAiApiKey, setAiApiKey } from '@extension/ai/rewriteSelection';
import { BUILTIN_DOCUMENT_TEMPLATES } from '@extension/templates/builtinTemplates';
import { loadBuiltinTemplateMarkdown } from '@extension/templates/loadBuiltinTemplate';
import { readUserTemplateMarkdownVerified } from '@extension/templates/loadUserTemplate';
import {
  expandUserTemplateDirectoryInput,
  listMarkdownTemplatesInUserDirectory,
} from '@extension/templates/userTemplateDirectory';
import { openRecoveryCenter } from '@extension/help/openRecoveryCenter';
import { recordMarklyEvent } from '@extension/telemetry/localTelemetry';

// 存储所有 WebView 的引用
const webviews = new Map<string, vscode.Webview>();

const richTableCommands: Array<{ id: string; op: RichTableCommandValue }> = [
  { id: 'markly.table.addRowBefore', op: 'addRowBefore' },
  { id: 'markly.table.addRowAfter', op: 'addRowAfter' },
  { id: 'markly.table.addColBefore', op: 'addColBefore' },
  { id: 'markly.table.addColAfter', op: 'addColAfter' },
  { id: 'markly.table.toggleHeaderRow', op: 'toggleHeaderRow' },
  { id: 'markly.table.alignLeft', op: 'alignLeft' },
  { id: 'markly.table.alignCenter', op: 'alignCenter' },
  { id: 'markly.table.alignRight', op: 'alignRight' },
  { id: 'markly.table.mergeCells', op: 'mergeCells' },
  { id: 'markly.table.splitCell', op: 'splitCell' },
  { id: 'markly.table.deleteTable', op: 'deleteTable' },
  { id: 'markly.table.deleteRow', op: 'deleteRow' },
  { id: 'markly.table.deleteCol', op: 'deleteCol' },
];

const imageAssetCommands = [
  { id: 'markly.image.copyMissingRefs', value: 'copyMissingRefs' },
  { id: 'markly.image.copyUnreferencedList', value: 'copyUnreferencedAssetList' },
  { id: 'markly.image.openAssetsDirectory', value: 'openAssetsDirectory' },
  { id: 'markly.image.openAssetsPanel', value: 'openImageAssetsPanel' },
  { id: 'markly.image.repairFirstMissingRef', value: 'repairFirstMissingRef' },
  { id: 'markly.image.repairMissingRefsBatch', value: 'repairMissingRefsBatch' },
  { id: 'markly.image.normalizeRefs', value: 'normalizeImageRefs' },
] as const;

export function registerWebview(uri: string, webview: vscode.Webview): void {
  webviews.set(uri, webview);
}

export function getWebview(uri: string): vscode.Webview | undefined {
  return webviews.get(uri);
}

export function getAllWebviews(): Map<string, vscode.Webview> {
  return webviews;
}

export function unregisterWebview(uri: string): void {
  webviews.delete(uri);
}

async function postEditorCommand(payload: Extract<ExtensionMessage, { type: 'EDITOR_COMMAND' }>['payload']): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const activeUri = editor?.document.uri.toString();
  const webview =
    (activeUri ? webviews.get(activeUri) : undefined) ??
    (webviews.size === 1 ? Array.from(webviews.values())[0] : undefined);

  if (!webview) {
    vscode.window.showInformationMessage('请先用 Markly 打开一个 Markdown 文件。');
    return;
  }

  await webview.postMessage({ type: 'EDITOR_COMMAND', payload } as ExtensionMessage);
}

export function registerCommands(
  context: vscode.ExtensionContext,
  modeController: ModeController,
  documentStore: DocumentStore
): void {
  // 切换模式 - 发送消息到 WebView
  const toggleModeCmd = vscode.commands.registerCommand(
    'markly.toggleMode',
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        const activeUri = editor?.document.uri.toString();

        if (activeUri && webviews.has(activeUri)) {
          // 如果当前文档使用我们的编辑器，发送消息到 WebView
          const webview = webviews.get(activeUri)!;
          const currentMode = modeController.getCurrentMode();
          const newMode = currentMode === 'source' ? 'preview' : 'source';
          webview.postMessage({
            type: 'SWITCH_MODE',
            payload: { mode: newMode },
          } as ExtensionMessage);
          modeController.switchTo(newMode);
        } else {
          // 如果使用的是 VSCode 默认编辑器，打开我们的预览编辑器
          if (editor && editor.document.languageId === 'markdown') {
            await vscode.commands.executeCommand(
              'vscode.openWith',
              editor.document.uri,
              'markly.preview'
            );
          } else {
            vscode.window.showInformationMessage(
              'Please open a Markdown file first'
            );
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `切换模式失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // 导出 PDF
  const exportPdfCmd = vscode.commands.registerCommand(
    'markly.export.pdf',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // 选择保存位置
      const defaultUri = vscode.Uri.file(
        editor.document.fileName.replace(/(\.md)$/, '.pdf')
      );
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'PDF': ['pdf'],
        },
      });

      if (!saveUri) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '导出 PDF...',
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: '正在准备内容...' });
            const content = editor.document.getText();

            progress.report({ message: '正在生成 PDF...' });
            console.log('[PDF Export] Starting export to:', saveUri.fsPath);

            const vs = vscode.workspace.getConfiguration('markly');
            const pfScope = vs.get<'off' | 'images' | 'full'>('export.preflight.scope', 'full');
            const pfBlock = vs.get<boolean>('export.preflight.blockOnIssues', false);
            if (
              !(await confirmContinueAfterExportPreflight({
                markdown: content,
                documentUri: editor.document.uri,
                scope: pfScope,
                blockOnIssues: pfBlock,
                formatLabel: 'PDF',
              }))
            ) {
              return;
            }
            const margin = vs.get<PdfConfig['margin']>('export.pdf.margin', {
              top: 25,
              right: 20,
              bottom: 25,
              left: 20,
            });
            const pdfCfg: PdfConfig = {
              format: vs.get<PdfConfig['format']>('export.pdf.format', 'A4'),
              margin: {
                top: margin?.top ?? 25,
                right: margin?.right ?? 20,
                bottom: margin?.bottom ?? 25,
                left: margin?.left ?? 20,
              },
              includeToc: vs.get<boolean>('export.pdf.includeToc', true),
              displayHeaderFooter: vs.get<boolean>('export.pdf.displayHeaderFooter', true),
            };
            const baseHref = vscode.Uri.file(path.dirname(editor.document.fileName)).toString(true) + '/';
            await exportToPdf(content, saveUri.fsPath, pdfExportOptionsFromPdfConfig(pdfCfg, baseHref));

            // 验证文件是否生成
            const fs = require('fs');
            if (fs.existsSync(saveUri.fsPath)) {
              const stats = fs.statSync(saveUri.fsPath);
              console.log('[PDF Export] Success! File size:', stats.size, 'bytes');
              recordMarklyEvent('export.pdf.ok', { kb: String(Math.round(stats.size / 1024)) });
              vscode.window.showInformationMessage(
                `PDF 导出成功! (${(stats.size / 1024).toFixed(1)} KB)`,
                '打开文件'
              ).then(selection => {
                if (selection === '打开文件') {
                  vscode.env.openExternal(vscode.Uri.file(saveUri.fsPath));
                }
              });
            } else {
              throw new Error('文件未生成');
            }
          } catch (error) {
            console.error('[PDF Export] Error:', error);
            await showExportFailureWithDiagnostics(context, 'pdf', error, {
              documentPath: editor.document.fileName,
              outputPath: saveUri.fsPath,
            });
          }
        }
      );
    }
  );

  // 导出 HTML
  const exportHtmlCmd = vscode.commands.registerCommand(
    'markly.export.html',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // 选择保存位置
      const defaultUri = vscode.Uri.file(
        editor.document.fileName.replace(/(\.md)$/, '.html')
      );
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'HTML': ['html'],
        },
      });

      if (!saveUri) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '导出 HTML...',
          cancellable: false,
        },
        async () => {
          try {
            const content = editor.document.getText();
            // 从文件名前提取标题
            const title = path.basename(editor.document.fileName, '.md');
            const markly = vscode.workspace.getConfiguration('markly');
            const pfScope = markly.get<'off' | 'images' | 'full'>('export.preflight.scope', 'full');
            const pfBlock = markly.get<boolean>('export.preflight.blockOnIssues', false);
            if (
              !(await confirmContinueAfterExportPreflight({
                markdown: content,
                documentUri: editor.document.uri,
                scope: pfScope,
                blockOnIssues: pfBlock,
                formatLabel: 'HTML',
              }))
            ) {
              return;
            }
            const htmlTheme =
              markly.get<'default' | 'print-friendly'>('export.html.theme', 'default') ?? 'default';
            const copyLocalImages = markly.get<boolean>('export.html.copyLocalImages', false);
            const assetsSubdirectory =
              markly.get<string>('export.html.assetsSubdirectory', 'markly-html-assets').trim() || 'markly-html-assets';
            await exportToHtml(content, saveUri.fsPath, {
              includeToc: true,
              title,
              htmlTheme,
              copyLocalImages,
              documentBaseDir: path.dirname(editor.document.fileName),
              assetsSubdirectory,
            });
            vscode.window.showInformationMessage(`HTML 已导出: ${path.basename(saveUri.fsPath)}`);
          } catch (error) {
            await showExportFailureWithDiagnostics(context, 'html', error, {
              documentPath: editor.document.fileName,
              outputPath: saveUri.fsPath,
            });
          }
        }
      );
    }
  );

  /** M88：发布前预览（与导出 HTML 同源管线） */
  const previewExportHtmlCmd = vscode.commands.registerCommand('markly.preview.exportHtml', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
      return;
    }
    if (editor.document.uri.scheme !== 'file') {
      vscode.window.showWarningMessage('导出预览仅支持本地磁盘上的 Markdown 文件。');
      return;
    }
    const uri = editor.document.uri;
    const stored = documentStore.getDocument(uri.toString());
    const markdown = stored?.content ?? editor.document.getText();
    const markly = vscode.workspace.getConfiguration('markly');
    const htmlTheme =
      markly.get<'default' | 'print-friendly'>('export.html.theme', 'default') ?? 'default';
    showExportHtmlPreviewPanel({
      markdown,
      documentUri: uri,
      htmlTheme,
    });
  });

  // 导出图片
  const exportImageCmd = vscode.commands.registerCommand(
    'markly.export.image',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      vscode.window.showInformationMessage('Image export coming soon!');
    }
  );

  const toggleOutlineCmd = vscode.commands.registerCommand(
    'markly.toggleOutline',
    () => postEditorCommand({ command: 'toggleOutline' })
  );

  const toggleFindReplaceCmd = vscode.commands.registerCommand(
    'markly.find.toggle',
    () => postEditorCommand({ command: 'toggleFindReplace' })
  );

  const findNextCmd = vscode.commands.registerCommand('markly.find.next', () =>
    postEditorCommand({ command: 'findNavigate', direction: 'next' })
  );

  const findPreviousCmd = vscode.commands.registerCommand('markly.find.previous', () =>
    postEditorCommand({ command: 'findNavigate', direction: 'previous' })
  );

  const pastePlainCmd = vscode.commands.registerCommand('markly.edit.pastePlain', () =>
    postEditorCommand({ command: 'pastePlain' })
  );

  const wrapUrlLinkCmd = vscode.commands.registerCommand('markly.edit.wrapUrlLink', () =>
    postEditorCommand({ command: 'wrapUrlLink' })
  );

  const imageBatchReplaceCmd = vscode.commands.registerCommand(
    'markly.image.batchReplaceInDocument',
    async () => {
      const from = await vscode.window.showInputBox({
        title: '批量替换',
        prompt: '将文档中以下内容全部替换（例如图片路径片段）',
        placeHolder: './old.png',
      });
      if (from === undefined) return;
      const trimmed = from.trim();
      if (!trimmed) {
        vscode.window.showWarningMessage('查找内容不能为空。');
        return;
      }
      const to = await vscode.window.showInputBox({
        title: '批量替换',
        prompt: '替换为',
        placeHolder: './new.png',
      });
      if (to === undefined) return;
      await postEditorCommand({ command: 'documentReplace', from: trimmed, to });
    }
  );

  const imageReplaceMovedRefCmd = vscode.commands.registerCommand('markly.image.replaceMovedImageRef', async () => {
    const editor = vscode.window.activeTextEditor;
    const docUri = editor?.document?.uri;
    if (!docUri) {
      vscode.window.showInformationMessage('请先打开一个 Markdown 文件。');
      return;
    }

    const pick = async (title: string) => {
      const sel = await vscode.window.showOpenDialog({
        title,
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
      });
      return sel?.[0];
    };

    const oldUri = await pick('选择“旧”的图片文件（移动/重命名前）');
    if (!oldUri) return;
    const newUri = await pick('选择“新”的图片文件（移动/重命名后）');
    if (!newUri) return;

    const from = toMarkdownImageRelativePath(docUri, oldUri);
    const to = toMarkdownImageRelativePath(docUri, newUri);
    await postEditorCommand({ command: 'documentReplace', from, to });
  });

  const insertTableCmd = vscode.commands.registerCommand(
    'markly.insert.table',
    () => postEditorCommand({ command: 'insert', value: 'table' })
  );

  const insertCodeBlockCmd = vscode.commands.registerCommand(
    'markly.insert.codeBlock',
    () => postEditorCommand({ command: 'insert', value: 'codeBlock' })
  );

  const richTableCmds = richTableCommands.map(({ id, op }) =>
    vscode.commands.registerCommand(id, () => postEditorCommand({ command: 'richTable', value: op }))
  );

  const imageAssetCmds = imageAssetCommands.map(({ id, value }) =>
    vscode.commands.registerCommand(id, () => postEditorCommand({ command: 'imageAsset', value }))
  );

  const insertImageCmd = vscode.commands.registerCommand(
    'markly.insert.image',
    () => postEditorCommand({ command: 'insert', value: 'image' })
  );

  const insertLinkCmd = vscode.commands.registerCommand(
    'markly.insert.link',
    () => postEditorCommand({ command: 'insert', value: 'link' })
  );

  const insertHrCmd = vscode.commands.registerCommand(
    'markly.insert.hr',
    () => postEditorCommand({ command: 'insert', value: 'hr' })
  );

  const assistSummarizeCmd = vscode.commands.registerCommand(
    'markly.assist.summarize',
    () => postEditorCommand({ command: 'writingAssist', value: 'summarize' })
  );

  const assistSuggestTitleCmd = vscode.commands.registerCommand(
    'markly.assist.suggestTitle',
    () => postEditorCommand({ command: 'writingAssist', value: 'suggestTitle' })
  );

  const assistFixMarkdownCmd = vscode.commands.registerCommand(
    'markly.assist.fixMarkdown',
    () => postEditorCommand({ command: 'writingAssist', value: 'fixMarkdown' })
  );

  const assistTidyTablesCmd = vscode.commands.registerCommand(
    'markly.assist.tidyTables',
    () => postEditorCommand({ command: 'writingAssist', value: 'tidyTables' })
  );

  const assistRewriteSelectionCmd = vscode.commands.registerCommand(
    'markly.assist.rewriteSelection',
    () => postEditorCommand({ command: 'writingAssist', value: 'rewriteSelection' })
  );

  const assistConvertTextToTableCmd = vscode.commands.registerCommand(
    'markly.assist.convertTextToGfmTable',
    () => postEditorCommand({ command: 'writingAssist', value: 'convertTextToGfmTable' })
  );

  const aiSetApiKeyCmd = vscode.commands.registerCommand('markly.ai.setApiKey', () => setAiApiKey(context));
  const aiClearApiKeyCmd = vscode.commands.registerCommand('markly.ai.clearApiKey', () => clearAiApiKey(context));

  const aiOpenPrivacyNoticeCmd = vscode.commands.registerCommand('markly.ai.openPrivacyNotice', async () => {
    const uri = vscode.Uri.joinPath(context.extensionUri, 'privacy', 'AI_PRIVACY.md');
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
    } catch {
      await vscode.window.showErrorMessage(
        '无法打开 Markly AI 隐私说明（扩展包可能不完整）。若从源码阅读，请打开仓库 `privacy/AI_PRIVACY.md`。'
      );
    }
  });

  const copyExportFailureDiagnosticsCmd = vscode.commands.registerCommand(
    'markly.export.copyFailureDiagnostics',
    () => runCopyLastExportFailureDiagnostics()
  );

  /** M89/M90：内置 + 自定义模板目录 → 另存为 → Markly 打开 */
  const newFromTemplateCmd = vscode.commands.registerCommand('markly.template.newFromLibrary', async () => {
    const vsCfg = vscode.workspace.getConfiguration('markly');
    const userDirRaw = String(vsCfg.get<string>('templates.userDirectory') ?? '').trim();
    const expandedUserDir = expandUserTemplateDirectoryInput(userDirRaw);

    if (userDirRaw && expandedUserDir) {
      try {
        const st = fs.statSync(expandedUserDir);
        if (!st.isDirectory()) {
          void vscode.window.showWarningMessage(`Markly：自定义模板路径不是文件夹：${expandedUserDir}`);
        }
      } catch {
        void vscode.window.showWarningMessage(`Markly：找不到自定义模板目录：${expandedUserDir}`);
      }
    }

    const userListed = expandedUserDir ? listMarkdownTemplatesInUserDirectory(expandedUserDir) : [];

    interface TemplatePick extends vscode.QuickPickItem {
      payload?:
        | { type: 'builtin'; id: string; suggestedFileName: string }
        | { type: 'user'; absolutePath: string; suggestedFileName: string };
    }

    const items: TemplatePick[] = [];
    items.push({ label: '内置模板', kind: vscode.QuickPickItemKind.Separator });
    for (const t of BUILTIN_DOCUMENT_TEMPLATES) {
      items.push({
        label: `$(book) ${t.label}`,
        description: t.description,
        detail: `建议保存为 ${t.suggestedFileName}`,
        payload: { type: 'builtin', id: t.id, suggestedFileName: t.suggestedFileName },
      });
    }
    if (userListed.length > 0 && expandedUserDir) {
      items.push({ label: '自定义模板', kind: vscode.QuickPickItemKind.Separator });
      for (const u of userListed) {
        items.push({
          label: `$(file-code) ${u.labelStem}`,
          description: u.fileName,
          detail: expandedUserDir,
          payload: { type: 'user', absolutePath: u.absolutePath, suggestedFileName: u.fileName },
        });
      }
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: '选择模板后将弹出「另存为」，保存后用 Markly 打开',
    });
    if (!picked?.payload) return;

    let content: string;
    try {
      if (picked.payload.type === 'builtin') {
        content = await loadBuiltinTemplateMarkdown(context.extensionUri, picked.payload.id);
      } else {
        if (!expandedUserDir) {
          void vscode.window.showErrorMessage('未配置有效的自定义模板目录。');
          return;
        }
        content = await readUserTemplateMarkdownVerified(picked.payload.absolutePath, expandedUserDir);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void vscode.window.showErrorMessage(`无法读取模板：${msg}`);
      return;
    }

    const suggestedName = picked.payload.suggestedFileName;
    const wf = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = wf ? vscode.Uri.joinPath(wf.uri, suggestedName) : vscode.Uri.file(suggestedName);
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { Markdown: ['md', 'markdown'] },
      saveLabel: '创建',
    });
    if (!saveUri) return;
    try {
      await vscode.workspace.fs.writeFile(saveUri, new TextEncoder().encode(content));
      await vscode.commands.executeCommand('vscode.openWith', saveUri, 'markly.preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void vscode.window.showErrorMessage(`创建文件失败：${msg}`);
    }
  });

  const recoveryCenterCmd = vscode.commands.registerCommand('markly.help.recoveryCenter', async () => {
    await openRecoveryCenter(context);
  });

  context.subscriptions.push(
    toggleModeCmd,
    exportPdfCmd,
    exportHtmlCmd,
    previewExportHtmlCmd,
    exportImageCmd,
    toggleOutlineCmd,
    toggleFindReplaceCmd,
    findNextCmd,
    findPreviousCmd,
    pastePlainCmd,
    wrapUrlLinkCmd,
    imageBatchReplaceCmd,
    imageReplaceMovedRefCmd,
    insertTableCmd,
    insertCodeBlockCmd,
    insertImageCmd,
    insertLinkCmd,
    insertHrCmd,
    ...imageAssetCmds,
    ...richTableCmds,
    assistSummarizeCmd,
    assistSuggestTitleCmd,
    assistFixMarkdownCmd,
    assistTidyTablesCmd,
    assistRewriteSelectionCmd,
    assistConvertTextToTableCmd,
    aiSetApiKeyCmd,
    aiClearApiKeyCmd,
    aiOpenPrivacyNoticeCmd,
    copyExportFailureDiagnosticsCmd,
    newFromTemplateCmd,
    recoveryCenterCmd
  );
}
