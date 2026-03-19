/**
 * 查找替换 Hook
 * @module composables/useFindReplace
 * @description 提供文本查找、替换、导航功能
 */

import { ref, computed, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { EditorView } from '@codemirror/view';
import { SearchCursor } from '@codemirror/search';

/**
 * 查找选项
 */
export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

/**
 * 匹配结果
 */
export interface MatchResult {
  from: number;
  to: number;
}

/**
 * useFindReplace 选项
 */
export interface UseFindReplaceOptions {
  editorView: Ref<EditorView | null>;
}

/**
 * useFindReplace 返回接口
 */
export interface UseFindReplaceReturn {
  findText: Ref<string>;
  replaceText: Ref<string>;
  isVisible: Ref<boolean>;
  findOptions: Ref<FindOptions>;
  currentMatch: ComputedRef<number>;
  totalMatches: ComputedRef<number>;
  hasMatches: ComputedRef<boolean>;
  matches: Ref<MatchResult[]>;
  findNext: () => void;
  findPrevious: () => void;
  replace: () => void;
  replaceAll: () => void;
  openPanel: () => void;
  closePanel: () => void;
  computeMatches: () => void;
}

/**
 * 查找替换 Hook
 * @param options - 配置选项
 * @returns 查找替换管理接口
 */
export const useFindReplace = (options: UseFindReplaceOptions): UseFindReplaceReturn => {
  const { editorView } = options;

  const findText = ref('');
  const replaceText = ref('');
  const isVisible = ref(false);
  const findOptions = ref<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });

  const matches = ref<MatchResult[]>([]);
  const currentMatchIndex = ref(-1);

  const currentMatch = computed<number>(() =>
    currentMatchIndex.value >= 0 ? currentMatchIndex.value + 1 : 0
  );
  const totalMatches = computed<number>(() => matches.value.length);
  const hasMatches = computed<boolean>(() => matches.value.length > 0);

  /**
   * 计算所有匹配位置
   */
  const computeMatches = (): void => {
    if (!editorView.value || !findText.value) {
      matches.value = [];
      currentMatchIndex.value = -1;
      return;
    }

    const newMatches: MatchResult[] = [];

    try {
      const cursor = new SearchCursor(
        editorView.value.state.doc,
        findText.value,
        0,
        editorView.value.state.doc.length,
        findOptions.value.caseSensitive ? undefined : (x) => x.toLowerCase()
      );

      while (!cursor.next().done) {
        const { from, to } = cursor.value;
        newMatches.push({ from, to });
      }
    } catch {
      // 正则错误等情况忽略
    }

    matches.value = newMatches;
    currentMatchIndex.value = newMatches.length > 0 ? 0 : -1;
  };

  watch(findText, computeMatches);
  watch(findOptions, computeMatches, { deep: true });

  /**
   * 跳转到指定匹配
   */
  const scrollToMatch = (index: number): void => {
    if (!editorView.value || index < 0 || index >= matches.value.length) return;
    const match = matches.value[index];
    editorView.value.dispatch({
      selection: { anchor: match.from, head: match.to },
      scrollIntoView: true,
    });
  };

  /**
   * 查找下一个
   */
  const findNext = (): void => {
    if (!hasMatches.value) return;
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.value.length;
    scrollToMatch(currentMatchIndex.value);
  };

  /**
   * 查找上一个
   */
  const findPrevious = (): void => {
    if (!hasMatches.value) return;
    currentMatchIndex.value =
      currentMatchIndex.value <= 0
        ? matches.value.length - 1
        : currentMatchIndex.value - 1;
    scrollToMatch(currentMatchIndex.value);
  };

  /**
   * 替换当前匹配
   */
  const replace = (): void => {
    if (!hasMatches.value || currentMatchIndex.value < 0 || !editorView.value) return;
    const match = matches.value[currentMatchIndex.value];
    editorView.value.dispatch({
      changes: { from: match.from, to: match.to, insert: replaceText.value },
    });
    computeMatches();
  };

  /**
   * 替换所有匹配
   */
  const replaceAll = (): void => {
    if (!hasMatches.value || !editorView.value) return;
    // 从后往前替换避免位置偏移
    const sortedMatches = [...matches.value].sort((a, b) => b.from - a.from);
    const changes = sortedMatches.map((match) => ({
      from: match.from,
      to: match.to,
      insert: replaceText.value,
    }));
    editorView.value.dispatch({ changes });
    matches.value = [];
    currentMatchIndex.value = -1;
  };

  const openPanel = (): void => {
    isVisible.value = true;
  };

  const closePanel = (): void => {
    isVisible.value = false;
  };

  return {
    findText,
    replaceText,
    isVisible,
    findOptions,
    currentMatch,
    totalMatches,
    hasMatches,
    matches,
    findNext,
    findPrevious,
    replace,
    replaceAll,
    openPanel,
    closePanel,
    computeMatches,
  };
};

export default useFindReplace;
