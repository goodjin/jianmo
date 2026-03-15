import * as vscode from 'vscode';
import type { DocumentStore } from '@core/documentStore';
import type { ExtensionConfig, WebViewMessage, ExtensionMessage } from '@types';
import { registerWebview, unregisterWebview } from '../commands';

export class MarkdownEditorProvider implements vscode.CustomEditorProvider {
  private readonly webviews = new Map<string, vscode.WebviewPanel>();
  private readonly documentVersions = new Map<string, number>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly documentStore: DocumentStore,
    private readonly config: ExtensionConfig
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');

    this.documentStore.setDocument(uri.toString(), {
      uri: uri.toString(),
      content: text,
      version: 0,
      isDirty: false,
    });

    return {
      uri,
      dispose: () => {
        this.documentStore.deleteDocument(uri.toString());
      },
    };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log('resolveCustomEditor called for:', document.uri.toString());
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

    // 监听 WebView 关闭
    webviewPanel.onDidDispose(() => {
      this.webviews.delete(uri);
      unregisterWebview(uri);
    });

    // 注册 WebView 到命令系统
    registerWebview(uri, webviewPanel.webview);

    // 监听文档变化
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
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

    webviewPanel.onDidDispose(() => {
      changeDisposable.dispose();
    });
  }

  private async handleWebviewMessage(
    uri: string,
    message: WebViewMessage
  ): Promise<void> {
    switch (message.type) {
      case 'READY':
        // WebView 准备就绪，发送初始内容
        const doc = this.documentStore.getDocument(uri);
        if (doc) {
          this.postMessage(uri, {
            type: 'INIT',
            payload: { content: doc.content, config: this.config },
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
        // 处理图片预览
        break;

      case 'OPEN_IMAGE_EDITOR':
        // 处理图片编辑
        break;

      case 'EXPORT':
        // 处理导出
        break;
    }
  }

  private async saveDocument(uri: string, content: string): Promise<void> {
    const docUri = vscode.Uri.parse(uri);
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri
    );

    if (editor) {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );
      edit.replace(docUri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
    }
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

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.css')
    );
    console.log('getWebviewHtml - scriptUri:', scriptUri.toString());
    console.log('getWebviewHtml - styleUri:', styleUri.toString());

    // 宽松的 CSP，允许所有必要的资源
    const csp = `default-src 'self'; img-src 'self' ${webview.cspSource} https: data: blob:; script-src 'self' ${webview.cspSource} https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' ${webview.cspSource} https: 'unsafe-inline'; font-src 'self' ${webview.cspSource} https: data:; connect-src 'self' ${webview.cspSource} https:;`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <script>
    window.onerror = function(msg, url, line, col, error) {
      document.body.innerHTML = '<div style="color:red;padding:20px;"><h3>Error:</h3><p>' + msg + '</p><p>URL: ' + url + '</p><p>Line: ' + line + '</p></div>';
    };
  </script>
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
  <title>简墨 Markdown</title>
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
  }
}
