import * as vscode from 'vscode';
import type { DocumentStore } from '@core/documentStore';
import type { ExtensionConfig, WebViewMessage, ExtensionMessage } from '@types';
import { registerWebview, unregisterWebview } from '../commands';
import { exportToPdf } from '@core/export/pdfExport';

export class MarkdownEditorProvider implements vscode.CustomEditorProvider {
  private readonly webviews = new Map<string, vscode.WebviewPanel>();
  private readonly documentVersions = new Map<string, number>();
  private changeDocumentListener: vscode.Disposable | null = null;
  private changeDisposable: vscode.Disposable | null = null;
  private _listeners: Set<(e: vscode.CustomDocumentEditEvent<vscode.CustomDocument>) => void> | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly documentStore: DocumentStore,
    private config: ExtensionConfig
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');

    // 初始化版本号
    const initialVersion = openContext.backupId ? parseInt(openContext.backupId, 10) : 1;
    this.documentVersions.set(uri.toString(), initialVersion);

    this.documentStore.setDocument(uri.toString(), {
      uri: uri.toString(),
      content: text,
      version: initialVersion,
      isDirty: false,
    });

    return {
      uri,
      dispose: () => {
        this.documentVersions.delete(uri.toString());
        this.documentStore.deleteDocument(uri.toString());
      },
    };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.toString();
    this.webviews.set(uri, webviewPanel);

    // 设置 WebView 选项
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'public'),
      ],
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
        const doc = this.documentStore.getDocument(uri);
        const version = this.documentVersions.get(uri) || 1;
        if (doc) {
          this.postMessage(uri, {
            type: 'INIT',
            payload: { content: doc.content, config: this.config, version },
          });
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

      case 'SAVE_IMAGE':
        await this.saveImage(uri, message.payload.data, message.payload.filename);
        break;

      case 'OPEN_IMAGE_PREVIEW':
        // 处理图片预览 - 使用 VSCode 内置图片预览
        if (message.payload?.src) {
          const imageUri = vscode.Uri.parse(uri).with({
            path: vscode.Uri.parse(uri).path.replace(/[^/]+$/, message.payload.src),
          });
          await vscode.commands.executeCommand('vscode.openWith', imageUri, 'imagePreview.default');
        }
        break;

      case 'OPEN_IMAGE_EDITOR':
        // 处理图片编辑 - 打开系统默认图片编辑器
        if (message.payload?.src) {
          const docUri = vscode.Uri.parse(uri);
          const imageUri = docUri.with({
            path: docUri.path.replace(/[^/]+$/, message.payload.src),
          });
          await vscode.commands.executeCommand('editor.action.openImageEditor', imageUri);
        }
        break;

      case 'SAVE':
        // 处理保存 - 保存当前文档内容
        if (message.payload?.content !== undefined) {
          await this.saveDocument(uri, message.payload.content);
          // 更新版本号
          const newVersion = (this.documentVersions.get(uri) || 0) + 1;
          this.documentVersions.set(uri, newVersion);
          this.documentStore.updateContent(uri, message.payload.content);
          // 通知 WebView 保存完成
          this.postMessage(uri, {
            type: 'SAVE_SUCCESS',
            payload: { version: newVersion },
          });
        }
        break;

      case 'EXPORT':
        // 处理导出 - 导出为不同格式
        await this.exportDocument(uri, message.payload);
        break;

      case 'getScrollPosition':
        // 处理获取滚动位置的请求
        // WebView 会在另一侧处理此消息并返回响应
        // 这里不需要特殊处理，因为响应会通过 scrollPositionResponse 发送
        break;
    }
  }

  /**
   * 处理来自 WebView 的滚动位置响应
   * 由 extension/index.ts 在收到消息时调用
   */
  public handleScrollPositionResponse(requestId: string, scrollTop: number, scrollLeft: number): void {
    // 发送响应回 WebView
    this.postMessage(requestId.split('-')[0], {
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

  private async saveImage(
    documentUri: string,
    data: string,
    filename: string
  ): Promise<string | undefined> {
    try {
      const docUri = vscode.Uri.parse(documentUri);
      const docDir = vscode.Uri.joinPath(docUri, '..');
      const assetsDir = vscode.Uri.joinPath(docDir, this.config.image.saveDirectory);

      // 确保 assets 目录存在
      try {
        await vscode.workspace.fs.stat(assetsDir);
      } catch {
        await vscode.workspace.fs.createDirectory(assetsDir);
      }

      // 解析 base64 数据
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // 保存图片
      const imagePath = vscode.Uri.joinPath(assetsDir, filename);
      await vscode.workspace.fs.writeFile(imagePath, buffer);

      // 返回相对路径
      return `${this.config.image.saveDirectory}/${filename}`;
    } catch (error) {
      console.error('Failed to save image:', error);
      return undefined;
    }
  }

  private async exportDocument(uri: string, payload: any): Promise<void> {
    if (!payload?.format) {
      return;
    }

    const docUri = vscode.Uri.parse(uri);
    const doc = this.documentStore.getDocument(uri);
    if (!doc) {
      return;
    }

    // 显示保存对话框
    const defaultName = docUri.fsPath.replace(/\.\w+$/, `.${payload.format}`);
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.parse(defaultName),
      filters: this.getExportFilters(payload.format),
    });

    if (!saveUri) {
      return;
    }

    // 转换内容到目标格式
    let content = doc.content;
    if (payload.format === 'html') {
      content = this.markdownToHtml(doc.content);
    } else if (payload.format === 'pdf') {
      // PDF 导出使用项目自己的 exportToPdf 函数
      await exportToPdf(doc.content, saveUri.fsPath, {
        includeToc: true,
        displayHeaderFooter: true,
      });
      vscode.window.showInformationMessage(`PDF 已导出: ${saveUri.fsPath}`);
      return;
    }

    // 写入文件
    const buffer = Buffer.from(content, 'utf-8');
    await vscode.workspace.fs.writeFile(saveUri, buffer);
  }

  private getExportFilters(format: string): { [key: string]: string[] } {
    const filters: { [key: string]: string[] } = {
      markdown: ['md', 'markdown'],
      html: ['html'],
      pdf: ['pdf'],
      json: ['json'],
    };
    return { [format.toUpperCase()]: filters[format] || ['*'] };
  }

  private markdownToHtml(markdown: string): string {
    // 简单的 Markdown 到 HTML 转换
    // 实际项目中可以使用 marked 或其他库
    let html = markdown
      // 标题
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // 粗体
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 图片
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      // 换行
      .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Exported</title>
</head>
<body>
${html}
</body>
</html>`;
  }

  postMessage(uri: string, message: ExtensionMessage): void {
    const webview = this.webviews.get(uri);
    if (webview) {
      webview.webview.postMessage(message);
    }
  }

  notifyConfigChange(config: ExtensionConfig): void {
    this.config = config;
    this.webviews.forEach((webview) => {
      webview.webview.postMessage({
        type: 'CONFIG_CHANGE',
        payload: { config },
      });
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https:;">
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
  <script src="${scriptUri}"></script>
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
