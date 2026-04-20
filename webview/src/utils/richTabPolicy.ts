import { isFormFieldKeyEventTarget, isMilkdownProseMirrorFocused } from './editorFocus';

export type EditorMode = 'rich' | 'ir' | 'source' | string;

/**
 * App.vue 的全局 Tab 处理（IR/Source 缩进）不应在 Rich 下抢走 ProseMirror 的表格/列表 keymap。
 */
export function shouldAppHandleTabIndent(args: {
  mode: EditorMode;
  key: string;
  target: EventTarget | null;
}): boolean {
  if (args.key !== 'Tab') return false;
  if (isFormFieldKeyEventTarget(args.target)) return false;
  if (args.mode === 'rich') return false;
  // Milkdown 常驻且可能被 v-show 隐藏：此时也不应强行缩进（避免未来模式切换细节回归）
  if (isMilkdownProseMirrorFocused()) return false;
  return true;
}
