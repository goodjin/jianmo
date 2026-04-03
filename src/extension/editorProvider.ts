/**
 * Markdown Editor Provider
 * @module extension/editorProvider
 * @description 实现 Custom Text Editor Provider 接口
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type {
  LegacyEditorOutboundMessage,
  LegacyTextEditorConfig,
  LegacyWebviewToExtension,
} from './legacyTextEditorProtocol';

/**
 * Markdown 编辑器提供者类
 */
export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  /** Webview 面板映射 */
  private webviewPanels = new Map<string, vscode.WebviewPanel>();

  /**
   * 构造函数
   * @param context - 扩展上下文
   */
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * 解析自定义文本编辑器
   * @param document - 文本文档
   * @param webviewPanel - Webview 面板
   * @param _token - 取消令牌
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 配置 Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
      ],
    };

    // 设置 HTML 内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // 保存面板引用
    this.webviewPanels.set(document.uri.toString(), webviewPanel);

    // 初始化内容
    this.postMessage(webviewPanel, {
      type: 'INIT',
      payload: {
        content: document.getText(),
        config: this.getEditorConfig(),
      },
    });

    // 设置消息处理
    this.setupMessageHandling(webviewPanel, document);

    // 监听文档变更
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.postMessage(webviewPanel, {
          type: 'DOCUMENT_CHANGE',
          payload: { content: e.document.getText() },
        });
      }
    });

    // 清理
    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      this.webviewPanels.delete(document.uri.toString());
    });
  }

  /**
   * 设置消息处理
   * @param webviewPanel - Webview 面板
   * @param document - 文本文档
   */
  private setupMessageHandling(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): void {
    webviewPanel.webview.onDidReceiveMessage(async (message: LegacyWebviewToExtension) => {
      switch (message.type) {
        case 'CONTENT_CHANGE':
          await this.updateDocument(document, message.payload.content);
          break;

        case 'UPLOAD_IMAGE':
          try {
            const imagePath = await this.saveImage(
              document,
              message.payload.base64,
              message.payload.filename
            );
            this.postMessage(webviewPanel, {
              type: 'IMAGE_SAVED',
              payload: { path: imagePath, filename: message.payload.filename },
            });
          } catch (error) {
            console.error('Failed to save image:', error);
          }
          break;

        case 'GET_THEME': {
          const theme = this.getVSCodeTheme();
          this.postMessage(webviewPanel, {
            type: 'THEME_CHANGE',
            payload: { theme },
          });
          break;
        }
      }
    });
  }

  /**
   * 更新文档内容
   * @param document - 文本文档
   * @param content - 新内容
   */
  private async updateDocument(
    document: vscode.TextDocument,
    content: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * 保存图片
   * @param document - 当前文档
   * @param base64 - Base64 编码的图片数据
   * @param filename - 文件名
   * @returns 相对路径
   */
  private async saveImage(
    document: vscode.TextDocument,
    base64: string,
    filename: string
  ): Promise<string> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      throw new Error('No workspace folder');
    }

    const assetsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');

    // 确保目录存在
    try {
      await vscode.workspace.fs.createDirectory(assetsDir);
    } catch {
      // 目录已存在
    }

    // 生成唯一文件名
    const uniqueFilename = this.generateUniqueFilename(filename);
    const imageUri = vscode.Uri.joinPath(assetsDir, uniqueFilename);

    // 保存文件
    const buffer = Buffer.from(
      base64.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    await vscode.workspace.fs.writeFile(imageUri, buffer);

    // 返回相对路径
    return path.relative(path.dirname(document.uri.fsPath), imageUri.fsPath);
  }

  /**
   * 生成唯一文件名
   * @param filename - 原始文件名
   * @returns 唯一文件名
   */
  private generateUniqueFilename(filename: string): string {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}-${timestamp}-${random}${ext}`;
  }

  /**
   * 发送消息到 Webview
   * @param webviewPanel - Webview 面板
   * @param message - 消息
   */
  private postMessage(
    webviewPanel: vscode.WebviewPanel,
    message: LegacyEditorOutboundMessage
  ): void {
    webviewPanel.webview.postMessage(message);
  }

  /**
   * 发送消息到活动 Webview
   * @param message - 消息
   */
  public postMessageToActiveWebview(message: LegacyEditorOutboundMessage): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    const panel = this.webviewPanels.get(activeEditor.document.uri.toString());
    if (panel) {
      this.postMessage(panel, message);
    }
  }

  /**
   * 获取编辑器配置
   * @returns 配置对象
   */
  private getEditorConfig(): LegacyTextEditorConfig {
    const config = vscode.workspace.getConfiguration('markly');
    return {
      theme: config.get('theme', 'auto'),
      tabSize: config.get('tabSize', 2),
      enableGFM: config.get('enableGFM', true),
      enableMath: config.get('enableMath', true),
      assetsPath: config.get('assetsPath', 'assets'),
    };
  }

  /**
   * 获取 VS Code 主题
   * @returns 主题名称
   */
  private getVSCodeTheme(): string {
    const config = vscode.workspace.getConfiguration('workbench');
    return config.get('colorTheme', 'vs');
  }

  /**
   * 获取 Webview HTML
   * @param webview - Webview
   * @returns HTML 字符串
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Markly Editor</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
