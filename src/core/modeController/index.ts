import * as vscode from 'vscode';
import type { DocumentStore } from '../documentStore';
import type { EditorMode, SourceCursorPosition, PreviewScrollPosition } from '@types';

export class ModeController implements vscode.Disposable {
  private currentMode: EditorMode = 'source';
  private isTransitioning = false;
  private toggleLock = false;
  private lastSwitchTime = 0;
  private readonly SWITCH_DEBOUNCE = 100; // ms

  private sourceCursor: SourceCursorPosition | null = null;
  private previewScroll: PreviewScrollPosition | null = null;

  private readonly onModeChangeEmitter = new vscode.EventEmitter<EditorMode>();
  public readonly onModeChange = this.onModeChangeEmitter.event;

  constructor(private readonly documentStore: DocumentStore) {}

  /**
   * 获取与当前文档关联的编辑器
   */
  private getEditorForDocument(): vscode.TextEditor | undefined {
    const document = this.documentStore.getCurrentDocument();
    if (!document) {
      return undefined;
    }
    return vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === document.uri.toString()
    );
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

  async switchTo(mode: EditorMode): Promise<void> {
    // 输入验证
    if (mode !== 'source' && mode !== 'preview') {
      throw new Error(`Invalid mode: ${mode}. Expected 'source' or 'preview'.`);
    }

    if (this.currentMode === mode) {
      return;
    }

    // 防抖检查
    const now = Date.now();
    if (now - this.lastSwitchTime < this.SWITCH_DEBOUNCE) {
      return;
    }

    // 防止重复切换
    if (this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    this.lastSwitchTime = now;

    // 保存当前模式以便失败时恢复
    const previousMode = this.currentMode;

    try {
      // 保存当前模式状态
      await this.saveCurrentState();

      // 切换模式
      this.currentMode = mode;

      // 恢复目标模式状态
      await this.restoreState();

      // 触发事件
      this.onModeChangeEmitter.fire(mode);

      console.log(`Mode switched: ${previousMode} -> ${mode}`);
    } catch (error) {
      // 切换失败，恢复到之前的状态
      console.error(`Mode switch failed: ${previousMode} -> ${mode}`, error);
      this.currentMode = previousMode;
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  async toggle(): Promise<void> {
    // 防止快速切换竞态条件
    if (this.toggleLock) {
      return;
    }
    this.toggleLock = true;

    try {
      const targetMode = this.currentMode === 'source' ? 'preview' : 'source';
      await this.switchTo(targetMode);
    } finally {
      this.toggleLock = false;
    }
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
        const document = this.documentStore.getCurrentDocument();
        if (document) {
          const webview = this.documentStore.getWebview(document.uri.toString());
          if (webview) {
            // 请求 WebView 当前滚动位置
            // 这里假设 WebView 会响应消息并调用 setPreviewScroll
            webview.postMessage({ type: 'getScrollPosition' });
          }
        }
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
      const document = this.documentStore.getCurrentDocument();
      if (document) {
        const webview = this.documentStore.getWebview(document.uri.toString());
        if (webview) {
          webview.postMessage({
            type: 'setScrollPosition',
            scrollTop: this.previewScroll.scrollTop,
            scrollLeft: this.previewScroll.scrollLeft,
          });
        }
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
