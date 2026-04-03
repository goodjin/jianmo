/**
 * 编辑器由 CodeMirror 托管焦点时，Mod-z / Mod-Shift-z 应由 CM6 historyKeymap 处理。
 * window 层不应再拦截，否则会在一次按键内连续 undo/redo 两次。
 */
export function skipWindowUndoRedoWhenEditorFocused(editorHasFocus: boolean | undefined): boolean {
  return editorHasFocus === true;
}
