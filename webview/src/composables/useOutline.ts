/**
 * 大纲导航 Hook
 * @module composables/useOutline
 * @description 提供大纲解析、当前章节检测和跳转功能
 */

import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { EditorView } from '@codemirror/view';
import { parseHeadings, buildTree } from '../shared/outline';
import type { HeadingNode } from '../shared/types';

/**
 * useOutline 选项
 */
export interface UseOutlineOptions {
  content: Ref<string>;
  editorView: Ref<EditorView | null>;
}

/**
 * useOutline 返回接口
 */
export interface UseOutlineReturn {
  headings: ComputedRef<HeadingNode[]>;
  tree: ComputedRef<HeadingNode[]>;
  currentHeading: ComputedRef<HeadingNode | null>;
  jumpToHeading: (heading: HeadingNode) => void;
}

/**
 * 大纲导航 Hook
 * @param options - 配置选项
 * @returns 大纲管理接口
 */
export const useOutline = (options: UseOutlineOptions): UseOutlineReturn => {
  const { content, editorView } = options;

  const headings = computed<HeadingNode[]>(() => parseHeadings(content.value));

  const tree = computed<HeadingNode[]>(() => buildTree(headings.value));

  const currentHeading = computed<HeadingNode | null>(() => {
    if (!editorView.value) return null;
    const cursorPos = editorView.value.state.selection.main.head;

    let current: HeadingNode | null = null;
    for (const heading of headings.value) {
      if (heading.from <= cursorPos) {
        current = heading;
      } else {
        break;
      }
    }
    return current;
  });

  const jumpToHeading = (heading: HeadingNode): void => {
    if (!editorView.value) return;
    editorView.value.dispatch({
      selection: { anchor: heading.from },
      scrollIntoView: true,
    });
    editorView.value.focus();
  };

  return {
    headings,
    tree,
    currentHeading,
    jumpToHeading,
  };
};

export default useOutline;
