/**
 * 桌面版原文编辑。用现成的源码编辑器，不改插件。
 * 每个标签一份，离开编辑时先从页面上摘下来，撤销步骤还留着。
 */
import { Compartment } from '@codemirror/state';
import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { createEditorState, createEditorView, destroyEditor } from '@wv/core/editor';

export interface EditHistory {
  canUndo: boolean;
  canRedo: boolean;
}

function fontTheme(px: number): ReturnType<typeof EditorView.theme> {
  const size = Number.isFinite(px) && px > 0 ? px : 14;
  return EditorView.theme({
    '&': { height: '100%' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: '"Fira Code", "JetBrains Mono", Consolas, ui-monospace, monospace',
    },
    '.cm-content': { fontSize: `${size}px` },
  });
}

export interface SourceEditorHandle {
  readonly dom: HTMLElement;
  readonly view: EditorView;
  getContent(): string;
  undo(): boolean;
  redo(): boolean;
  history(): EditHistory;
  focus(): void;
  reveal(pos: number): void;
  setFontSize(px: number): void;
  setWordWrap(on: boolean): void;
  destroy(): void;
}

function wrapExtension(on: boolean): typeof EditorView.lineWrapping | [] {
  return on ? EditorView.lineWrapping : [];
}

export function mountSourceEditor(
  parent: HTMLElement,
  content: string,
  fontSize: number,
  onChange: (text: string, history: EditHistory) => void,
  wordWrap = true
): SourceEditorHandle {
  const fontSlot = new Compartment();
  const wrapSlot = new Compartment();
  const holder = document.createElement('div');
  holder.className = 'source-editor-mount';
  holder.style.height = '100%';
  parent.appendChild(holder);

  const report = (state: EditorView['state']): EditHistory => ({
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
  });
  const textOf = (state: EditorView['state']): string => {
    const raw = state.sliceDoc();
    return newline === '\r\n' ? raw.replace(/\n/g, '\r\n') : raw;
  };

  const text = String(content ?? '');
  // 编辑器内部用 LF。文件原本是 CRLF 时，读出来再拼回 CRLF，保存才不会改掉换行。
  const newline: '\n' | '\r\n' = text.includes('\r\n') ? '\r\n' : '\n';
  const state = createEditorState(text, 'source', [
    fontSlot.of(fontTheme(fontSize)),
    wrapSlot.of(wrapExtension(wordWrap)),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      onChange(textOf(update.state), report(update.state));
    }),
  ]);
  const view = createEditorView(holder, state);

  return {
    dom: holder,
    view,
    getContent: () => textOf(view.state),
    undo: () => {
      const ran = undo(view);
      if (ran) onChange(textOf(view.state), report(view.state));
      return ran;
    },
    redo: () => {
      const ran = redo(view);
      if (ran) onChange(textOf(view.state), report(view.state));
      return ran;
    },
    history: () => report(view.state),
    focus: () => view.focus(),
    reveal: (pos: number) => {
      const max = view.state.doc.length;
      const at = Math.max(0, Math.min(max, pos));
      view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      view.focus();
    },
    setFontSize: (px: number) => {
      view.dispatch({ effects: fontSlot.reconfigure(fontTheme(px)) });
    },
    setWordWrap: (on: boolean) => {
      view.dispatch({ effects: wrapSlot.reconfigure(wrapExtension(on)) });
    },
    destroy: () => {
      destroyEditor(view);
      holder.remove();
    },
  };
}
