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
        changes: expect.objectContaining({ insert: '\n```\n代码内容\n```\n' }),
      }));
    });

    it('insertTable 应该插入表格语法', () => {
      const view = makeView('', 0, 0);
      const { insertTable } = useToolbar({ editorView: ref(view as any) });
      insertTable();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |' }),
      }));
    });

    it('insertHr 应该插入水平分隔线', () => {
      const view = makeView('', 0, 0);
      const { insertHr } = useToolbar({ editorView: ref(view as any) });
      insertHr();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '\n---\n' }),
      }));
    });

    it('insertMath 应该插入数学公式语法', () => {
      const view = makeView('', 0, 0);
      const { insertMath } = useToolbar({ editorView: ref(view as any) });
      insertMath();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ insert: '$$\n公式\n$$' }),
      }));
    });
  });

  describe('toggleHeading', () => {
    const makeHeadingView = (lineText: string, cursorPos: number) => {
      dispatch = vi.fn();
      focus = vi.fn();
      return {
        state: {
          doc: {
            sliceString: vi.fn((f, t) => lineText.slice(f, t)),
            lineAt: vi.fn(() => ({
              from: 0,
              to: lineText.length,
              text: lineText,
            })),
          },
          selection: { main: { from: cursorPos, to: cursorPos, head: cursorPos, empty: true } },
        },
        dispatch,
        focus,
      };
    };

    it('在普通文本行添加标题', () => {
      const view = makeHeadingView('Title', 0);
      const { toggleHeading } = useToolbar({ editorView: ref(view as any) });
      toggleHeading(2);
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 0, insert: '## ' },
      }));
    });

    it('替换已有标题级别', () => {
      const view = makeHeadingView('## Title', 3);
      const { toggleHeading } = useToolbar({ editorView: ref(view as any) });
      toggleHeading(3);
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 3, insert: '### ' },
      }));
    });

    it('移除相同级别的标题', () => {
      const view = makeHeadingView('## Title', 3);
      const { toggleHeading } = useToolbar({ editorView: ref(view as any) });
      toggleHeading(2);
      // existingMatch[0] = '## ' (3 chars), so we delete from 0 to 3
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 3, insert: '' },
      }));
    });
  });

  describe('列表操作', () => {
    const makeLineView = (lineText: string, cursorPos: number) => {
      dispatch = vi.fn();
      focus = vi.fn();
      return {
        state: {
          doc: {
            sliceString: vi.fn((f, t) => lineText.slice(f, t)),
            lineAt: vi.fn(() => ({
              from: 0,
              to: lineText.length,
              text: lineText,
            })),
          },
          selection: { main: { from: cursorPos, to: cursorPos, head: cursorPos, empty: true } },
        },
        dispatch,
        focus,
      };
    };

    it('toggleBulletList 在普通行添加 bullet list 前缀', () => {
      const view = makeLineView('Item', 0);
      const { toggleBulletList } = useToolbar({ editorView: ref(view as any) });
      toggleBulletList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 0, insert: '- ' },
      }));
    });

    it('toggleBulletList 移除已有的 bullet list 前缀', () => {
      const view = makeLineView('- Item', 2);
      const { toggleBulletList } = useToolbar({ editorView: ref(view as any) });
      toggleBulletList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 2, insert: '' },
      }));
    });

    it('toggleOrderedList 在普通行添加 ordered list 前缀', () => {
      const view = makeLineView('Item', 0);
      const { toggleOrderedList } = useToolbar({ editorView: ref(view as any) });
      toggleOrderedList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 0, insert: '1. ' },
      }));
    });

    it('toggleOrderedList 移除已有的 ordered list 前缀', () => {
      const view = makeLineView('1. Item', 3);
      const { toggleOrderedList } = useToolbar({ editorView: ref(view as any) });
      toggleOrderedList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 3, insert: '' },
      }));
    });

    it('toggleTaskList 在普通行添加 task list 前缀', () => {
      const view = makeLineView('Task', 0);
      const { toggleTaskList } = useToolbar({ editorView: ref(view as any) });
      toggleTaskList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 0, insert: '- [ ] ' },
      }));
    });

    it('toggleTaskList 移除已有的 task list 前缀', () => {
      const view = makeLineView('- [ ] Task', 6);
      const { toggleTaskList } = useToolbar({ editorView: ref(view as any) });
      toggleTaskList();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 6, insert: '' },
      }));
    });

    it('toggleBlockquote 在普通行添加 blockquote 前缀', () => {
      const view = makeLineView('Quote', 0);
      const { toggleBlockquote } = useToolbar({ editorView: ref(view as any) });
      toggleBlockquote();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 0, insert: '> ' },
      }));
    });

    it('toggleBlockquote 移除已有的 blockquote 前缀', () => {
      const view = makeLineView('> Quote', 2);
      const { toggleBlockquote } = useToolbar({ editorView: ref(view as any) });
      toggleBlockquote();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 2, insert: '' },
      }));
    });

    it('toggleBulletList 切换时会移除其他列表前缀', () => {
      const view = makeLineView('1. Item', 3);
      const { toggleBulletList } = useToolbar({ editorView: ref(view as any) });
      toggleBulletList();
      // 两次 dispatch：第一次移除旧前缀，第二次添加新前缀
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, expect.objectContaining({
        changes: { from: 0, to: 3, insert: '' },
      }));
      expect(dispatch).toHaveBeenNthCalledWith(2, expect.objectContaining({
        changes: { from: 0, to: 0, insert: '- ' },
      }));
    });

    it('列表操作应调用 focus', () => {
      const view = makeLineView('Item', 0);
      const { toggleBulletList } = useToolbar({ editorView: ref(view as any) });
      toggleBulletList();
      expect(focus).toHaveBeenCalled();
    });

    it('editorView 为 null 时列表操作不应报错', () => {
      const { toggleBulletList, toggleOrderedList, toggleTaskList, toggleBlockquote } = useToolbar({ editorView: ref(null) });
      expect(() => toggleBulletList()).not.toThrow();
      expect(() => toggleOrderedList()).not.toThrow();
      expect(() => toggleTaskList()).not.toThrow();
      expect(() => toggleBlockquote()).not.toThrow();
    });
  });
});
