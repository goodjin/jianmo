/**
 * useFindReplace Hook 单元测试
 * @module composables/__tests__/useFindReplace
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useFindReplace } from '../useFindReplace';

// Mock SearchCursor
vi.mock('@codemirror/search', () => ({
  SearchCursor: vi.fn().mockImplementation((doc, query, from, to, normalize) => {
    const text = doc.toString();
    const searchText = normalize ? query.toLowerCase() : query;
    const sourceText = normalize ? text.toLowerCase() : text;

    const results: Array<{ from: number; to: number }> = [];
    let idx = sourceText.indexOf(searchText, 0);
    while (idx !== -1) {
      results.push({ from: idx, to: idx + searchText.length });
      idx = sourceText.indexOf(searchText, idx + 1);
    }

    let pos = -1;
    return {
      next() {
        pos++;
        if (pos < results.length) {
          this.value = results[pos];
          this.done = false;
        } else {
          this.done = true;
        }
        return this;
      },
      value: { from: 0, to: 0 },
      done: false,
    };
  }),
}));

const createMockView = (text: string) => {
  const dispatch = vi.fn();
  return {
    state: {
      doc: {
        toString: () => text,
        length: text.length,
      },
      selection: { main: { from: 0, to: 0, head: 0, empty: true } },
    },
    dispatch,
  };
};

describe('useFindReplace', () => {
  describe('初始化', () => {
    it('应该有正确的初始状态', () => {
      const { findText, replaceText, isVisible, hasMatches, totalMatches } = useFindReplace({
        editorView: ref(null),
      });

      expect(findText.value).toBe('');
      expect(replaceText.value).toBe('');
      expect(isVisible.value).toBe(false);
      expect(hasMatches.value).toBe(false);
      expect(totalMatches.value).toBe(0);
    });
  });

  describe('openPanel / closePanel', () => {
    it('openPanel 应该显示面板', () => {
      const { isVisible, openPanel } = useFindReplace({ editorView: ref(null) });
      openPanel();
      expect(isVisible.value).toBe(true);
    });

    it('closePanel 应该隐藏面板', () => {
      const { isVisible, openPanel, closePanel } = useFindReplace({ editorView: ref(null) });
      openPanel();
      closePanel();
      expect(isVisible.value).toBe(false);
    });
  });

  describe('computeMatches', () => {
    it('editorView 为 null 时应该返回空', () => {
      const { computeMatches, matches } = useFindReplace({ editorView: ref(null) });
      computeMatches();
      expect(matches.value).toEqual([]);
    });

    it('查找文本为空时应该返回空', async () => {
      const view = createMockView('hello world');
      const { findText, matches } = useFindReplace({ editorView: ref(view as any) });

      findText.value = '';
      await nextTick();
      expect(matches.value).toEqual([]);
    });

    it('应该找到所有匹配项', async () => {
      const view = createMockView('hello world hello');
      const { findText, matches, totalMatches } = useFindReplace({ editorView: ref(view as any) });

      findText.value = 'hello';
      await nextTick();

      expect(totalMatches.value).toBe(2);
      expect(matches.value[0]).toEqual({ from: 0, to: 5 });
      expect(matches.value[1]).toEqual({ from: 12, to: 17 });
    });
  });

  describe('findNext / findPrevious', () => {
    it('findNext 没有匹配时不应该报错', () => {
      const { findNext } = useFindReplace({ editorView: ref(null) });
      expect(() => findNext()).not.toThrow();
    });

    it('findNext 应该循环导航', async () => {
      const view = createMockView('hello hello hello');
      const { findText, currentMatch, findNext } = useFindReplace({ editorView: ref(view as any) });

      findText.value = 'hello';
      await nextTick();

      expect(currentMatch.value).toBe(1);

      findNext();
      expect(currentMatch.value).toBe(2);

      findNext();
      expect(currentMatch.value).toBe(3);

      findNext(); // 循环回第1个
      expect(currentMatch.value).toBe(1);
    });

    it('findPrevious 应该反向导航', async () => {
      const view = createMockView('hello hello');
      const { findText, currentMatch, findPrevious } = useFindReplace({ editorView: ref(view as any) });

      findText.value = 'hello';
      await nextTick();

      expect(currentMatch.value).toBe(1);
      findPrevious(); // 从第1个跳到最后一个（第2个）
      expect(currentMatch.value).toBe(2);
    });
  });

  describe('replace / replaceAll', () => {
    it('replace 无匹配时不应该报错', () => {
      const { replace } = useFindReplace({ editorView: ref(null) });
      expect(() => replace()).not.toThrow();
    });

    it('replace 应该替换当前匹配', async () => {
      const view = createMockView('hello world');
      const { findText, replaceText, replace } = useFindReplace({ editorView: ref(view as any) });

      findText.value = 'hello';
      replaceText.value = 'hi';
      await nextTick();

      replace();

      expect(view.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        changes: { from: 0, to: 5, insert: 'hi' },
      }));
    });

    it('replaceAll 应该替换所有匹配', async () => {
      const view = createMockView('hello world hello');
      const { findText, replaceText, replaceAll } = useFindReplace({ editorView: ref(view as any) });

      findText.value = 'hello';
      replaceText.value = 'hi';
      await nextTick();

      replaceAll();

      expect(view.dispatch).toHaveBeenCalled();
    });
  });
});
