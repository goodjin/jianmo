/**
 * useOutline Hook 单元测试
 * @module composables/__tests__/useOutline
 */

import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useOutline } from '../useOutline';

describe('useOutline', () => {
  const createOptions = (content: string) => ({
    content: ref(content),
    editorView: ref(null),
  });

  describe('headings', () => {
    it('应该解析标题', () => {
      const { headings } = useOutline(createOptions('# H1\n## H2'));

      expect(headings.value).toHaveLength(2);
      expect(headings.value[0].text).toBe('H1');
      expect(headings.value[1].text).toBe('H2');
    });

    it('内容变化时应该更新标题', () => {
      const content = ref('# H1');
      const { headings } = useOutline({ content, editorView: ref(null) });

      expect(headings.value).toHaveLength(1);

      content.value = '# H1\n## H2\n### H3';
      expect(headings.value).toHaveLength(3);
    });
  });

  describe('tree', () => {
    it('应该构建树形结构', () => {
      const { tree } = useOutline(createOptions('# H1\n## H2'));

      expect(tree.value).toHaveLength(1);
      expect(tree.value[0].children).toHaveLength(1);
    });

    it('空内容应该返回空树', () => {
      const { tree } = useOutline(createOptions(''));

      expect(tree.value).toEqual([]);
    });
  });

  describe('currentHeading', () => {
    it('editorView 为 null 时应该返回 null', () => {
      const { currentHeading } = useOutline(createOptions('# H1'));

      expect(currentHeading.value).toBeNull();
    });

    it('应该返回光标所在的标题', () => {
      const mockView = {
        state: {
          selection: {
            main: { head: 10 },
          },
        },
      };

      const editorView = ref(mockView as any);
      const { currentHeading } = useOutline({
        content: ref('# H1\n## H2'),
        editorView,
      });

      // 光标在位置 10，在 '## H2' 处（位置 5），所以 currentHeading 是 H2
      expect(currentHeading.value).not.toBeNull();
      expect(currentHeading.value?.text).toBe('H2');
    });
  });

  describe('jumpToHeading', () => {
    it('editorView 为 null 时不应该报错', () => {
      const { headings, jumpToHeading } = useOutline(createOptions('# H1'));

      expect(() => jumpToHeading(headings.value[0])).not.toThrow();
    });

    it('应该调用 dispatch 和 focus', () => {
      const dispatch = vi.fn();
      const focus = vi.fn();
      const mockView = {
        state: { selection: { main: { head: 0 } } },
        dispatch,
        focus,
      };

      const { headings, jumpToHeading } = useOutline({
        content: ref('# H1'),
        editorView: ref(mockView as any),
      });

      jumpToHeading(headings.value[0]);

      expect(dispatch).toHaveBeenCalledWith({
        selection: { anchor: headings.value[0].from },
        scrollIntoView: true,
      });
      expect(focus).toHaveBeenCalled();
    });
  });
});
