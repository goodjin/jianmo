import * as vscode from 'vscode';
import type { DocumentStore } from '../documentStore';
import type { EditorMode, SourceCursorPosition, PreviewScrollPosition } from '@types';

export class ModeController implements vscode.Disposable {
  private currentMode: EditorMode = 'source';
  private isTransitioning = false;
  private lastSwitchTime = 0;
  private readonly SWITCH_DEBOUNCE = 100; // ms

  private sourceCursor: SourceCursorPosition | null = null;
  private previewScroll: PreviewScrollPosition | null = null;

  private readonly onModeChangeEmitter = new vscode.EventEmitter<EditorMode>();
  public readonly onModeChange = this.onModeChangeEmitter.event;

  constructor(private readonly documentStore: DocumentStore) {}

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

    try {
      // 保存当前模式状态
      await this.saveCurrentState();

      // 切换模式
      const previousMode = this.currentMode;
      this.currentMode = mode;

      // 恢复目标模式状态
      await this.restoreState();

      // 触发事件
      this.onModeChangeEmitter.fire(mode);

      console.log(`Mode switched: ${previousMode} -> ${mode}`);
    } finally {
      this.isTransitioning = false;
    }
  }

  async toggle(): Promise<void> {
    const targetMode = this.currentMode === 'source' ? 'preview' : 'source';
    await this.switchTo(targetMode);
  }

  private async saveCurrentState(): Promise<void> {
    if (this.currentMode === 'source') {
      // 保存源码模式光标位置
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.sourceCursor = {
          lineNumber: editor.selection.active.line,
          column: editor.selection.active.character,
        };
      }
    } else {
      // 预览模式的滚动位置由 WebView 保存
      // 通过消息传递获取
    }
  }

  private async restoreState(): Promise<void> {
    if (this.currentMode === 'source' && this.sourceCursor) {
      // 恢复源码模式光标位置
      const editor = vscode.window.activeTextEditor;
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
    }
    // 预览模式的滚动位置由 WebView 恢复
  }

  setPreviewScroll(scroll: PreviewScrollPosition): void {
    this.previewScroll = scroll;
  }

  getPreviewScroll(): PreviewScrollPosition | null {
    return this.previewScroll;
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
