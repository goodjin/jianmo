import * as vscode from 'vscode';
import type { DocumentStore } from '../documentStore';
import type { EditorMode, SourceCursorPosition, PreviewScrollPosition } from '@types';

// WebView 提供者接口
export interface WebviewProvider {
  getWebview(uri: string): vscode.Webview | undefined;
}

// 默认的 WebviewProvider 实现（返回 undefined）
const defaultWebviewProvider: WebviewProvider = {
  getWebview: () => undefined,
};

export class ModeController implements vscode.Disposable {
  /** 仅作宿主侧粗略镜像：由 Webview `TRACK_EDITOR_MODE` / 就绪态同步（不可视为单一真源）。 */
  private currentMode: EditorMode = 'rich';
  private isTransitioning = false;
  private toggleLock = false;
  private lastSwitchTime = 0;
  private readonly SWITCH_DEBOUNCE = 100; // ms

  private sourceCursor: SourceCursorPosition | null = null;
  private previewScroll: PreviewScrollPosition | null = null;

  // 待处理的 scroll position 请求
  private pendingScrollRequests = new Map<string, (position: PreviewScrollPosition) => void>();

  private readonly onModeChangeEmitter = new vscode.EventEmitter<EditorMode>();
  public readonly onModeChange = this.onModeChangeEmitter.event;

  // WebView provider（可选，用于获取 webview 实例）
  private webviewProvider: WebviewProvider = defaultWebviewProvider;

  // WebView 消息处理器
  private webviewMessageHandler: ((message: any) => void) | null = null;

  constructor(
    private readonly documentStore: DocumentStore,
    webviewProvider?: WebviewProvider
  ) {
    if (webviewProvider) {
      this.webviewProvider = webviewProvider;
    }
    // 设置 WebView 消息监听器来处理 scroll position 响应
    this.setupWebviewMessageListener();
  }

  /**
   * 设置 WebView provider（在 extension 初始化时调用）
   */
  setWebviewProvider(provider: WebviewProvider): void {
    this.webviewProvider = provider;
  }

  /**
   * 注册 WebView 消息处理器
   * 在创建 WebviewPanel 或 WebviewView 后调用此方法
   * @param handler 处理 WebView 消息的回调函数
   */
  setWebviewMessageHandler(handler: (message: any) => void): void {
    this.webviewMessageHandler = handler;
  }

  /**
   * 设置 WebView 消息监听器
   * 初始化消息处理（实际的消息接收由 setWebviewMessageHandler 设置的处理器完成）
   */
  private setupWebviewMessageListener(): void {
    console.log('[ModeController] WebView message listener initialized');
  }

  /**
   * 处理从 WebView 收到的消息
   * 由外部注册的 handler 调用
   */
  private handleWebviewMessage(message: any): void {
    if (!message || !message.type) {
      return;
    }

    switch (message.type) {
      case 'scrollPositionResponse':
        // 处理滚动位置响应
        this.handleScrollPositionResponse(message.requestId, {
          scrollTop: message.scrollTop || 0,
          scrollLeft: message.scrollLeft || 0,
        });
        break;
      // 以下消息类型由 customEditor.ts 处理，这里静默忽略
      case 'READY':
      case 'CONTENT_CHANGE':
      case 'SAVE':
      case 'SAVE_IMAGE':
      case 'OPEN_IMAGE_PREVIEW':
      case 'OPEN_IMAGE_EDITOR':
      case 'EXPORT':
      case 'UPLOAD_IMAGE':
      case 'CHECK_LOCAL_IMAGE_REFS':
      case 'LIST_ASSETS_IMAGE_FILES':
      case 'FIND_MARKDOWN_BACKLINKS':
      case 'OPEN_MARKDOWN_DOCUMENT':
      case 'MARKDOWN_HOVER_PREVIEW_REQUEST':
      case 'OPEN_WORKSPACE_SEARCH':
      case 'AI_SUMMARY_REQUEST':
      case 'AI_SUGGEST_TITLES_REQUEST':
      case 'AI_CONVERT_TEXT_TO_TABLE_REQUEST':
      case 'getScrollPosition':
        break;
      case 'TRACK_EDITOR_MODE':
      case 'REQUEST_PREVIEW_HTML':
        break;
      default:
        console.log(`[ModeController] Unknown message type: ${message.type}`);
    }
  }

  /**
   * 派发从 WebView 收到的消息
   * 在 WebviewPanel/WebviewView 的 onDidReceiveMessage 回调中调用
   * @param message 从 WebView 收到的消息
   */
  public dispatchWebviewMessage(message: any): void {
    this.handleWebviewMessage(message);
  }

  /**
   * 获取当前活动的文本编辑器对应的文档 URI
   */
  private getCurrentDocumentUri(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document.uri.toString();
  }

  /**
   * 获取与当前文档关联的编辑器
   */
  private getEditorForDocument(): vscode.TextEditor | undefined {
    const uri = this.getCurrentDocumentUri();
    if (!uri) {
      return undefined;
    }
    return vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === uri
    );
  }

  /**
   * 获取当前文档的 WebView
   */
  private getWebviewForCurrentDocument(): vscode.Webview | undefined {
    const uri = this.getCurrentDocumentUri();
    if (!uri) {
      return undefined;
    }
    return this.webviewProvider.getWebview(uri);
  }

  /**
   * 请求 WebView 的滚动位置（返回 Promise）
   */
  private requestScrollPosition(): Promise<PreviewScrollPosition> {
    return new Promise((resolve) => {
      const uri = this.getCurrentDocumentUri();
      if (!uri) {
        resolve({ scrollTop: 0, scrollLeft: 0 });
        return;
      }

      // 生成唯一请求 ID
      const requestId = `${uri}-${Date.now()}`;
      
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingScrollRequests.delete(requestId);
        resolve({ scrollTop: 0, scrollLeft: 0 });
      }, 2000);

      // 存储待处理的回调
      this.pendingScrollRequests.set(requestId, (position) => {
        clearTimeout(timeout);
        this.pendingScrollRequests.delete(requestId);
        resolve(position);
      });

      // 发送请求到 WebView
      const webview = this.getWebviewForCurrentDocument();
      if (webview) {
        webview.postMessage({ 
          type: 'getScrollPosition', 
          requestId 
        } as { type: string; requestId: string });
      } else {
        clearTimeout(timeout);
        this.pendingScrollRequests.delete(requestId);
        resolve({ scrollTop: 0, scrollLeft: 0 });
      }
    });
  }

  /**
   * 处理 WebView 发来的滚动位置响应
   */
  public handleScrollPositionResponse(requestId: string, position: PreviewScrollPosition): void {
    const callback = this.pendingScrollRequests.get(requestId);
    if (callback) {
      callback(position);
    }
  }

  getCurrentMode(): EditorMode {
    return this.currentMode;
  }

  isSourceMode(): boolean {
    return this.currentMode === 'source';
  }

  isPreviewMode(): boolean {
    return this.currentMode === 'preview';
  }

  /** 由 Webview 上报同步（宿主侧预览/快捷键状态；不做滚动光标恢复）。 */
  setSyncedEditorMode(mode: EditorMode): void {
    if (mode === 'ir' || mode === 'source' || mode === 'rich' || mode === 'preview') {
      this.currentMode = mode;
    }
  }

  /** @deprecated Rich/Source/预览 由内嵌 Webview 做主；宿主侧若仍调用，等价于粗略更新镜像。 */
  async switchTo(mode: EditorMode): Promise<void> {
    if (!(mode === 'source' || mode === 'preview' || mode === 'rich' || mode === 'ir')) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.currentMode = mode;
    this.onModeChangeEmitter.fire(mode);
  }

  async toggle(): Promise<void> {
    const order: EditorMode[] = ['rich', 'source', 'preview'];
    const ix = Math.max(0, order.indexOf(this.currentMode));
    await this.switchTo(order[(ix + 1) % order.length]!);
  }

  private async saveCurrentState(): Promise<void> {
    if (this.currentMode === 'source') {
      // 保存源码模式光标位置
      const editor = this.getEditorForDocument();
      if (editor) {
        this.sourceCursor = {
          lineNumber: editor.selection.active.line,
          column: editor.selection.active.character,
        };
      }
    } else if (this.currentMode === 'preview') {
      // 保存预览模式滚动位置
      // 滚动位置由 WebView 在切换前通过 setPreviewScroll 设置
      // 如果没有预先设置，则从当前活动的 WebView 获取
      if (!this.previewScroll) {
        // 使用 Promise 等待 WebView 响应
        this.previewScroll = await this.requestScrollPosition();
      }
    }
  }

  private async restoreState(): Promise<void> {
    if (this.currentMode === 'source' && this.sourceCursor) {
      // 恢复源码模式光标位置
      const editor = this.getEditorForDocument();
      if (editor) {
        const position = new vscode.Position(
          this.sourceCursor.lineNumber,
          this.sourceCursor.column
        );
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } else if (this.currentMode === 'preview' && this.previewScroll) {
      // 恢复预览模式滚动位置
      const webview = this.getWebviewForCurrentDocument();
      if (webview) {
        webview.postMessage({
          type: 'setScrollPosition',
          scrollTop: this.previewScroll.scrollTop,
          scrollLeft: this.previewScroll.scrollLeft,
        });
      }
    }
  }

  setPreviewScroll(scroll: PreviewScrollPosition): void {
    this.previewScroll = scroll;
  }

  getPreviewScroll(): PreviewScrollPosition | null {
    return this.previewScroll;
  }

  clearPreviewScroll(): void {
    this.previewScroll = null;
  }

  setSourceCursor(cursor: SourceCursorPosition): void {
    this.sourceCursor = cursor;
  }

  getSourceCursor(): SourceCursorPosition | null {
    return this.sourceCursor;
  }

  dispose(): void {
    this.onModeChangeEmitter.dispose();
  }
}
