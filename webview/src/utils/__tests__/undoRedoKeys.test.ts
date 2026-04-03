import { describe, it, expect } from 'vitest';
import { skipWindowUndoRedoWhenEditorFocused } from '../undoRedoKeys';

describe('skipWindowUndoRedoWhenEditorFocused', () => {
  it('焦点在 CM 内时 window 不应再处理 Mod-z（由 skip 为 true 表示）', () => {
    expect(skipWindowUndoRedoWhenEditorFocused(true)).toBe(true);
  });

  it('无焦点或未定义时由 window 快捷键兜底（不 skip）', () => {
    expect(skipWindowUndoRedoWhenEditorFocused(false)).toBe(false);
    expect(skipWindowUndoRedoWhenEditorFocused(undefined)).toBe(false);
  });
});
