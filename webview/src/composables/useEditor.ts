/**
 * 编辑器核心 Hook
 * @module composables/useEditor
 * @description 提供完整的编辑器状态管理和操作功能
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { EditorView } from '@codemirror/view';
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import type { EditorMode, EditorOptions, EditorInstance } from '../types';
import { createEditorState, createEditorView, destroyEditor } from '../core';

/**
 * 编辑器 Hook
 * @param options - 编辑器配置选项
 * @returns 编辑器实例
 */
export const useEditor = (options: EditorOptions = {}): EditorInstance => {
  // ========== 状态 ==========
  const view: Ref<EditorView | null> = ref(null);
  const mode: Ref<EditorMode> = ref(options.initialMode || 'ir');
  const containerRef: Ref<HTMLElement | null> = ref(null);

  // ========== 计算属性 ==========
  const content: ComputedRef<string> = computed(() => {
    return view.value?.state.doc.toString() || '';
  });

  const canUndo: ComputedRef<boolean> = computed(() => {
    if (!view.value) return false;
    return undoDepth(view.value.state) > 0;
  });

  const canRedo: ComputedRef<boolean> = computed(() => {
    if (!view.value) return false;
    return redoDepth(view.value.state) > 0;
  });

  // ========== 核心操作 ==========

  /**
   * 创建编辑器
   * @param container - 容器元素
   */
  const createEditor = (container: HTMLElement): void => {
    if (view.value) {
      destroyEditor(view.value);
    }

    containerRef.value = container;

    const state = createEditorState(
      options.initialContent || '',
      mode.value
    );

    view.value = createEditorView(container, state);
  };

  /**
   * 销毁编辑器
   */
  const destroy = (): void => {
    destroyEditor(view.value);
    view.value = null;
    containerRef.value = null;
  };

  /**
   * 获取内容
   * @returns 当前内容
   */
  const getContent = (): string => {
    return view.value?.state.doc.toString() || '';
  };

  /**
   * 设置内容
   * @param newContent - 新内容
   */
  const setContent = (newContent: string): void => {
    if (!view.value) return;

    view.value.dispatch({
      changes: {
        from: 0,
        to: view.value.state.doc.length,
        insert: newContent,
      },
    });
  };

  /**
   * 切换模式
   * @param newMode - 新模式
   */
  const switchMode = (newMode: EditorMode): void => {
    if (!view.value || mode.value === newMode) return;

    const currentContent = getContent();

    // 创建新状态
    const newState = createEditorState(currentContent, newMode);

    // 更新视图
    view.value.setState(newState);
    mode.value = newMode;

    // 触发回调
    options.onModeChange?.(newMode);
  };

  // ========== 历史操作 ==========

  /**
   * 撤销
   */
  const undoAction = (): void => {
    if (!view.value) return;
    undo(view.value);
  };

  /**
   * 重做
   */
  const redoAction = (): void => {
    if (!view.value) return;
    redo(view.value);
  };

  // ========== 生命周期 ==========

  onUnmounted(() => {
    destroy();
  });

  // ========== 返回实例 ==========
  return {
    // 状态
    view,
    mode,
    content,

    // 核心操作
    createEditor,
    switchMode,
    getContent,
    setContent,
    destroy,

    // 历史操作
    undo: undoAction,
    redo: redoAction,
    canUndo,
    canRedo,
  };
};

export default useEditor;
