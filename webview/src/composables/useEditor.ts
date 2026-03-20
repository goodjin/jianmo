/**
 * 编辑器核心 Hook
 * @module composables/useEditor
 * @description 提供完整的编辑器状态管理和操作功能
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { EditorView } from '@codemirror/view';
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

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && options.onChange) {
        options.onChange(update.state.doc.toString());
      }
    });

    const state = createEditorState(
      options.initialContent || '',
      mode.value,
      [updateListener]
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
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && options.onChange) {
        options.onChange(update.state.doc.toString());
      }
    });
    const newState = createEditorState(currentContent, newMode, [updateListener]);

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

  // ========== 格式化与插入操作 ==========

  /**
   * 应用文本格式 (如加粗、斜体等)
   * 这是一个基础实现，实际需要根据所选文字包裹特定的 Markdown 语法
   * @param format - 格式类型
   */
  const applyFormat = (format: string): void => {
    if (!view.value) return;

    const { state, dispatch } = view.value;
    const selection = state.selection.main;
    const text = state.sliceDoc(selection.from, selection.to);

    let prefix = '';
    let suffix = '';

    switch (format) {
      case 'bold':
        prefix = '**';
        suffix = '**';
        break;
      case 'italic':
        prefix = '*';
        suffix = '*';
        break;
      case 'strike':
        prefix = '~~';
        suffix = '~~';
        break;
      case 'code':
        prefix = '`';
        suffix = '`';
        break;
      case 'h1':
        prefix = '# ';
        break;
      case 'h2':
        prefix = '## ';
        break;
      case 'h3':
        prefix = '### ';
        break;
      case 'h4':
        prefix = '#### ';
        break;
      case 'h5':
        prefix = '##### ';
        break;
      case 'h6':
        prefix = '###### ';
        break;
      case 'quote':
        prefix = '> ';
        break;
      case 'bulletList':
        prefix = '- ';
        break;
      case 'orderedList':
        prefix = '1. ';
        break;
      case 'taskList':
        prefix = '- [ ] ';
        break;
      default:
        console.log('Unsupported format:', format);
        return;
    }

    dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: `${prefix}${text}${suffix}`,
      },
      selection: { anchor: selection.from + prefix.length, head: selection.from + prefix.length + text.length },
    });
  };

  /**
   * 插入特定节点或内容
   * @param type - 节点类型
   */
  const insertNode = (type: string): void => {
    if (!view.value) return;

    const { state, dispatch } = view.value;
    const selection = state.selection.main;

    let insertText = '';

    switch (type) {
      case 'link':
        insertText = '[链接文字](https://example.com)';
        break;
      case 'image':
        insertText = '![图片描述](图片地址)';
        break;
      case 'codeBlock':
        insertText = '\n```\n代码内容\n```\n';
        break;
      case 'table':
        insertText = '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n';
        break;
      case 'hr':
        insertText = '\n---\n';
        break;
      case 'math':
        insertText = '\n$$\nE = mc^2\n$$\n';
        break;
      case 'footnote':
        insertText = '[^1]\n\n[^1]: 脚注内容\n';
        break;
      case 'toc':
        insertText = `\n<!-- TOC -->\n`;
        break;
      default:
        console.log('Unsupported insert type:', type);
        return;
    }

    dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: insertText,
      },
      selection: { anchor: selection.from + insertText.length },
    });
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

    // 格式与插入操作
    applyFormat,
    insertNode,
  };
};

export default useEditor;
