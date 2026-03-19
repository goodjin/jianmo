/**
 * useToolbar Hook 单元测试
 * @module composables/__tests__/useToolbar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useToolbar } from '../useToolbar';

describe('useToolbar', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let focus: ReturnType<typeof vi.fn>;
  let mockView: any;

  const makeView = (docText: string, from = 0, to = 0) => {
    dispatch = vi.fn();
    focus = vi.fn();
    return {
      state: {
        doc: {
          sliceString: vi.fn((f, t) => docText.slice(f, t)),
          lineAt: vi.fn(() => ({
            from: 0,
            to: docText.length,
            text: docText,
          })),
        },
        selection: { main: { from, to, head: to, empty: from === to } },
      },
      dispatch,
      focus,
    };
  };

  describe('hasSelection', () => {
    it('无选区时应该返回 false', () => {
      const view = makeView('hello', 0, 0);
      const { hasSelection } = useToolbar({ editorView: ref(view as any) });
      expect(hasSelection.value).toBe(false);
    });

    it('有选区时应该返回 true', () => {
      const view = makeView('hello', 0, 5);
      const { hasSelection } = useToolbar({ editorView: ref(view as any) });
      expect(hasSelection.value).toBe(true);
    });

    it('editorView 为 null 时应该返回 false', () => {
      const { hasSelection } = useToolbar({ editorView: ref(null) });
      expect(hasSelection.value).toBe(false);
    });
  });

  describe('wrapSelection', () => {
    it('应该用标记包裹选区文本', () => {
      const view = makeView('hello', 0, 5);
      const { wrapSelection } = useToolbar({ editorView: ref(view as any) });

      wrapSelection('**');

      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 5, insert: '**hello**' },
      }));
    });

    it('editorView 为 null 时不应该报错', () => {
      const { wrapSelection } = useToolbar({ editorView: ref(null) });
      expect(() => wrapSelection('**')).not.toThrow();
    });
  });

  describe('insertAtCursor', () => {
    it('应该在光标位置插入文本', () => {
      const view = makeView('hello', 5, 5);
      const { insertAtCursor } = useToolbar({ editorView: ref(view as any) });

      insertAtCursor('world');

      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 5, to: 5, insert: 'world' },
      }));
    });
  });

  describe('格式操作', () => {
    it('toggleBold 应该添加 **', () => {
      const view = makeView('text', 0, 4);
      const { toggleBold } = useToolbar({ editorView: ref(view as any) });
      toggleBold();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 4, insert: '**text**' },
      }));
    });

    it('toggleItalic 应该添加 *', () => {
      const view = makeView('text', 0, 4);
      const { toggleItalic } = useToolbar({ editorView: ref(view as any) });
      toggleItalic();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 4, insert: '*text*' },
      }));
    });

    it('toggleStrikethrough 应该添加 ~~', () => {
      const view = makeView('text', 0, 4);
      const { toggleStrikethrough } = useToolbar({ editorView: ref(view as any) });
      toggleStrikethrough();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 4, insert: '~~text~~' },
      }));
    });

    it('toggleCode 应该添加 `', () => {
      const view = makeView('code', 0, 4);
      const { toggleCode } = useToolbar({ editorView: ref(view as any) });
      toggleCode();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 4, insert: '`code`' },
      }));
    });
  });

  describe('插入操作', () => {
    it('insertLink 有选区时应该包裹文本', () => {
      const view = makeView('text', 0, 4);
      const { insertLink } = useToolbar({ editorView: ref(view as any) });
      insertLink();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 4, insert: '[text](url)' },
      }));
    });

    it('insertLink 无选区时应该插入占位符', () => {
      const view = makeView('', 0, 0);
      const { insertLink } = useToolbar({ editorView: ref(view as any) });
      insertLink();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '[链接文本](url)' }),
      }));
    });

    it('insertImage 应该插入图片语法', () => {
      const view = makeView('', 0, 0);
      const { insertImage } = useToolbar({ editorView: ref(view as any) });
      insertImage();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '![图片描述](图片路径)' }),
      }));
    });

    it('insertCodeBlock 应该插入代码块语法', () => {
      const view = makeView('', 0, 0);
      const { insertCodeBlock } = useToolbar({ editorView: ref(view as any) });
      insertCodeBlock();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '```\n代码\n```' }),
      }));
    });
  });
});
