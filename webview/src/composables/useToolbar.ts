/**
 * 工具栏 Hook
 * @module composables/useToolbar
 * @description 提供工具栏编辑操作
 */

import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { EditorView } from '@codemirror/view';

/**
 * useToolbar 选项
 */
export interface UseToolbarOptions {
  editorView: Ref<EditorView | null>;
}

/**
 * useToolbar 返回接口
 */
export interface UseToolbarReturn {
  hasSelection: ComputedRef<boolean>;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  toggleCode: () => void;
  toggleHeading: (level: number) => void;
  insertLink: () => void;
  insertImage: () => void;
  insertCodeBlock: () => void;
  insertTable: () => void;
  insertHr: () => void;
  insertMath: () => void;
  wrapSelection: (before: string, after?: string) => void;
  insertAtCursor: (text: string) => void;
}

/**
 * 工具栏操作 Hook
 * @param options - 配置选项
 * @returns 工具栏操作接口
 */
export const useToolbar = (options: UseToolbarOptions): UseToolbarReturn => {
  const { editorView } = options;

  const selection = computed(() => editorView.value?.state.selection.main);

  const hasSelection = computed<boolean>(() =>
    selection.value ? !selection.value.empty : false
  );

  /**
   * 用标记包裹选区文本
   */
  const wrapSelection = (before: string, after: string = before): void => {
    if (!editorView.value || !selection.value) return;

    const { from, to } = selection.value;
    const text = editorView.value.state.doc.sliceString(from, to);

    editorView.value.dispatch({
      changes: { from, to, insert: `${before}${text}${after}` },
      selection: {
        anchor: from + before.length,
        head: from + before.length + text.length,
      },
    });
    editorView.value.focus();
  };

  /**
   * 在光标位置插入文本
   */
  const insertAtCursor = (text: string): void => {
    if (!editorView.value) return;

    const pos = editorView.value.state.selection.main.head;
    editorView.value.dispatch({
      changes: { from: pos, to: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
    editorView.value.focus();
  };

  const toggleBold = (): void => wrapSelection('**');

  const toggleItalic = (): void => wrapSelection('*');

  const toggleStrikethrough = (): void => wrapSelection('~~');

  const toggleCode = (): void => wrapSelection('`');

  const toggleHeading = (level: number): void => {
    if (!editorView.value) return;

    const state = editorView.value.state;
    const line = state.doc.lineAt(state.selection.main.head);
    const marks = '#'.repeat(level) + ' ';

    // 如果行已有相同级别的标题，移除它
    const existingMatch = line.text.match(/^(#{1,6})\s/);
    if (existingMatch && existingMatch[1].length === level) {
      editorView.value.dispatch({
        changes: { from: line.from, to: line.from + level + 1, insert: '' },
      });
    } else if (existingMatch) {
      // 替换现有标题级别
      const existingLen = existingMatch[1].length + 1;
      editorView.value.dispatch({
        changes: { from: line.from, to: line.from + existingLen, insert: marks },
      });
    } else {
      editorView.value.dispatch({
        changes: { from: line.from, to: line.from, insert: marks },
      });
    }
    editorView.value.focus();
  };

  const insertLink = (): void => {
    if (hasSelection.value) {
      wrapSelection('[', '](url)');
    } else {
      insertAtCursor('[链接文本](url)');
    }
  };

  const insertImage = (): void => {
    insertAtCursor('![图片描述](图片路径)');
  };

  const insertCodeBlock = (): void => {
    insertAtCursor('```\n代码\n```');
  };

  const insertTable = (): void => {
    insertAtCursor('| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |');
  };

  const insertHr = (): void => {
    insertAtCursor('\n---\n');
  };

  const insertMath = (): void => {
    insertAtCursor('$$\n公式\n$$');
  };

  return {
    hasSelection,
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleCode,
    toggleHeading,
    insertLink,
    insertImage,
    insertCodeBlock,
    insertTable,
    insertHr,
    insertMath,
    wrapSelection,
    insertAtCursor,
  };
};

export default useToolbar;
