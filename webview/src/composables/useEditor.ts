/**
 * 编辑器核心 Hook
 * @module composables/useEditor
 * @description 提供完整的编辑器状态管理和操作功能
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { EditorView } from '@codemirror/view';
import { undo as cmUndo, redo as cmRedo, undoDepth, redoDepth } from '@codemirror/commands';
import type { EditorMode, EditorOptions, EditorInstance } from '../types';
import { createEditorState, createEditorView, destroyEditor } from '../core';

/**
 * 编辑器 Hook
 * @param options - 编辑器配置选项
 * @returns 编辑器实例
 */
export const useEditor = (options: EditorOptions = {}): EditorInstance => {
  const promptInput: NonNullable<EditorOptions['promptInput']> =
    options.promptInput ??
    ((message: string, defaultValue = ''): string | null => {
      if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
        return null;
      }
      return window.prompt(message, defaultValue);
    });

  // ========== 状态 ==========
  const view: Ref<EditorView | null> = ref(null);
  const mode: Ref<EditorMode> = ref(options.initialMode || 'ir');
  const containerRef: Ref<HTMLElement | null> = ref(null);
  const showLineNumbers: Ref<boolean> = ref(false);

  // ========== 简易历史栈（替代 CM6 内置 undo/redo，避免某些环境下 RangeError） ==========
  const historyDone = ref<string[]>([]);
  const historyUndone = ref<string[]>([]);
  let isHistoryMutation = false;

  const nativeHistoryEnabled = (): boolean =>
    typeof window !== 'undefined' && (window as any).__marklyUseNativeHistory === true;

  const createUpdateListener = () =>
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        stateVersion.value++;
        if (!isHistoryMutation) {
          const prev = update.startState.doc.toString();
          if (prev !== update.state.doc.toString()) {
            historyDone.value.push(prev);
            historyUndone.value = [];
          }
        }
        options.onChange?.(update.state.doc.toString());
      }
    });

  // ========== 计算属性 ==========
  // 递增版本号，用于触发 Vue 重新计算依赖 CM6 内部状态的 computed
  const stateVersion = ref(0);

  const content: ComputedRef<string> = computed(() => {
    stateVersion.value; // 订阅版本变化
    return view.value?.state.doc.toString() || '';
  });

  const canUndo: ComputedRef<boolean> = computed(() => {
    stateVersion.value;
    if (nativeHistoryEnabled()) {
      const v = view.value;
      return !!v && undoDepth(v.state) > 0;
    }
    return historyDone.value.length > 0;
  });

  const canRedo: ComputedRef<boolean> = computed(() => {
    stateVersion.value;
    if (nativeHistoryEnabled()) {
      const v = view.value;
      return !!v && redoDepth(v.state) > 0;
    }
    return historyUndone.value.length > 0;
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
      mode.value,
      [createUpdateListener()]
    );

    view.value = createEditorView(container, state);
    if (!showLineNumbers.value) {
      view.value.dom.classList.add('cm-hide-line-numbers');
    } else {
      view.value.dom.classList.remove('cm-hide-line-numbers');
    }
    // 创建后清空历史（把初始内容当作基线）
    historyDone.value = [];
    historyUndone.value = [];
  };

  /**
   * 销毁编辑器
   */
  const destroy = (): void => {
    destroyEditor(view.value);
    view.value = null;
    containerRef.value = null;
    historyDone.value = [];
    historyUndone.value = [];
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

    const currentContent = view.value.state.doc.toString();
    // 只有内容真正变化时才更新，避免重置光标位置
    if (newContent === currentContent) return;

    // 保存当前选区/光标位置
    const selection = view.value.state.selection;
    const mainSel = selection.main;

    view.value.dispatch({
      changes: {
        from: 0,
        to: view.value.state.doc.length,
        insert: newContent,
      },
      // 尝试恢复光标位置（如果新内容长度允许）
      selection: mainSel.anchor <= newContent.length && mainSel.head <= newContent.length
        ? { anchor: mainSel.anchor, head: mainSel.head }
        : undefined,
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
    const newState = createEditorState(currentContent, newMode, [createUpdateListener()]);

    /**
     * 真实用户环境中，反复 view.setState()（尤其伴随 block replace widgets / selection 变化）
     * 可能触发 CodeMirror 内部 DOM/selection 映射异常：
     * RangeError: Invalid child in posBefore
     *
     * 这里改为“销毁并重建 EditorView”，以换取更稳定的模式切换。
     */
    const container = containerRef.value;
    if (!container) return;

    destroyEditor(view.value);
    view.value = createEditorView(container, newState);
    mode.value = newMode;

    const root = view.value.dom;
    if (showLineNumbers.value) {
      root.classList.remove('cm-hide-line-numbers');
    } else {
      root.classList.add('cm-hide-line-numbers');
    }
    // 切模式视为“基线重建”，清空历史，避免跨 state 的 undo/redo 不一致
    historyDone.value = [];
    historyUndone.value = [];

    // 触发回调
    options.onModeChange?.(newMode);
  };

  // ========== 历史操作 ==========

  /**
   * 撤销（纯数据操作，不处理焦点 — 焦点由 UI 层负责）
   */
  const undoAction = (): void => {
    const v = view.value;
    if (!v) return;
    if (nativeHistoryEnabled()) {
      // 注意：在某些测试环境（jsdom）里 CM6 原生 history 可能抛 RangeError。
      // 这里保持直连 CM6，便于在真实浏览器里复现/定位问题。
      try {
        (window as any).__marklyNativeHistoryLastError = null;
        cmUndo({ state: v.state, dispatch: (tr) => v.dispatch(tr) });
      } catch (e) {
        (window as any).__marklyNativeHistoryLastError = {
          op: 'undo',
          message: e instanceof Error ? e.message : String(e),
        };
      }
      return;
    }
    const prev = historyDone.value.pop();
    if (prev === undefined) return;
    const cur = v.state.doc.toString();
    historyUndone.value.push(cur);
    isHistoryMutation = true;
    try {
      setContent(prev);
    } finally {
      isHistoryMutation = false;
    }
  };

  /**
   * 重做（纯数据操作，不处理焦点）
   */
  const redoAction = (): void => {
    const v = view.value;
    if (!v) return;
    if (nativeHistoryEnabled()) {
      try {
        (window as any).__marklyNativeHistoryLastError = null;
        cmRedo({ state: v.state, dispatch: (tr) => v.dispatch(tr) });
      } catch (e) {
        (window as any).__marklyNativeHistoryLastError = {
          op: 'redo',
          message: e instanceof Error ? e.message : String(e),
        };
      }
      return;
    }
    const next = historyUndone.value.pop();
    if (next === undefined) return;
    const cur = v.state.doc.toString();
    historyDone.value.push(cur);
    isHistoryMutation = true;
    try {
      setContent(next);
    } finally {
      isHistoryMutation = false;
    }
  };

  // ========== 格式化与插入操作 ==========

  /**
   * 应用文本格式 (如加粗、斜体等)
   * 这是一个基础实现，实际需要根据所选文字包裹特定的 Markdown 语法
   * @param format - 格式类型
   */
  /**
   * 行级格式 - 标题、列表、引用等在行首操作
   */
  const LINE_PREFIXES: Record<string, string> = {
    h1: '# ', h2: '## ', h3: '### ', h4: '#### ', h5: '##### ', h6: '###### ',
    quote: '> ', bulletList: '- ', orderedList: '1. ', taskList: '- [ ] ',
  };

  const applyFormat = (format: string): void => {
    if (!view.value) return;

    const { state, dispatch } = view.value;
    const selection = state.selection.main;

    // 行级格式：在行首操作
    if (format in LINE_PREFIXES) {
      const newPrefix = LINE_PREFIXES[format];
      const line = state.doc.lineAt(selection.from);
      const lineText = line.text;

      // 标题格式：替换已有标题前缀或添加新前缀
      if (format.startsWith('h')) {
        const headingMatch = lineText.match(/^(#{1,6})\s/);
        if (headingMatch) {
          // 已有标题前缀 - 如果相同则移除（toggle），否则替换
          const existingPrefix = headingMatch[0];
          if (existingPrefix === newPrefix) {
            // toggle off
            dispatch({
              changes: { from: line.from, to: line.from + existingPrefix.length, insert: '' },
            });
          } else {
            dispatch({
              changes: { from: line.from, to: line.from + existingPrefix.length, insert: newPrefix },
            });
          }
        } else {
          // 无标题前缀 - 在行首添加
          dispatch({
            changes: { from: line.from, insert: newPrefix },
          });
        }
        return;
      }

      // 列表/引用格式：如果光标不在行首且行非空，先换行
      const cursorInLine = selection.from - line.from;
      if (cursorInLine > 0 && lineText.trim().length > 0) {
        // 在当前光标处插入换行 + 前缀
        dispatch({
          changes: { from: selection.from, to: selection.to, insert: `\n${newPrefix}` },
          selection: { anchor: selection.from + 1 + newPrefix.length },
        });
      } else {
        // 在行首添加前缀（检查是否已存在同样的前缀 - toggle）
        if (lineText.startsWith(newPrefix)) {
          dispatch({
            changes: { from: line.from, to: line.from + newPrefix.length, insert: '' },
          });
        } else {
          dispatch({
            changes: { from: line.from, insert: newPrefix },
          });
        }
      }
      return;
    }

    // 内联格式：包裹选中文本
    const text = state.sliceDoc(selection.from, selection.to);
    const isCollapsed = selection.from === selection.to;
    let prefix = '';
    let suffix = '';

    switch (format) {
      case 'bold': prefix = '**'; suffix = '**'; break;
      case 'italic': prefix = '*'; suffix = '*'; break;
      case 'strike': prefix = '~~'; suffix = '~~'; break;
      case 'code': prefix = '`'; suffix = '`'; break;
      case 'clear': {
        // 清除格式：移除所有 markdown 标记
        let text = state.sliceDoc(selection.from, selection.to);
        const isCollapsed = selection.from === selection.to;

        if (isCollapsed) {
          // 无选区时，清除当前行的格式标记
          const line = state.doc.lineAt(selection.from);
          let lineText = line.text;
          // 移除标题前缀
          lineText = lineText.replace(/^#{1,6}\s+/, '');
          // 移除列表前缀
          lineText = lineText.replace(/^(\s*)([-*+])\s+/, '$1');
          lineText = lineText.replace(/^(\s*)(\d+)\.\s+/, '$1');
          // 移除引用前缀
          lineText = lineText.replace(/^>\s*/, '');

          dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: lineText,
            },
          });
        } else {
          // 有选区时，移除选中文本中的内联格式
          // 移除加粗 **text** 或 __text__
          text = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
          // 移除斜体 *text* 或 _text_
          text = text.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
          // 移除删除线 ~~text~~
          text = text.replace(/~~([^~]+)~~/g, '$1');
          // 移除行内代码 `code`
          text = text.replace(/`([^`]+)`/g, '$1');
          // 移除链接 [text](url) -> text
          text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
          // 移除图片 ![alt](url) -> alt
          text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

          dispatch({
            changes: {
              from: selection.from,
              to: selection.to,
              insert: text,
            },
          });
        }
        return;
      }
      default:
        console.log('Unsupported format:', format);
        return;
    }

    // 无选区时：插入 markers 并将光标放在中间
    if (isCollapsed) {
      dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: `${prefix}${suffix}`,
        },
        selection: { anchor: selection.from + prefix.length },
      });
    } else {
      dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: `${prefix}${text}${suffix}`,
        },
        selection: { anchor: selection.from + prefix.length, head: selection.from + prefix.length + text.length },
      });
    }
  };

  /**
   * 插入特定节点或内容
   * @param type - 节点类型
   */
  const insertNode = (type: string): void => {
    if (!view.value) return;

    const { state, dispatch } = view.value;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);

    let insertText = '';

    switch (type) {
      case 'link': {
        const linkText = selectedText || promptInput('链接文字:', '链接文字') || '链接文字';
        const linkUrl = promptInput('链接地址:', 'https://') || 'https://';
        insertText = `[${linkText}](${linkUrl})`;
        break;
      }
      case 'image': {
        const altText = selectedText || promptInput('图片描述:', '图片描述') || '图片描述';
        const imgUrl = promptInput('图片地址:', 'https://') || 'https://';
        insertText = `![${altText}](${imgUrl})`;
        break;
      }
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

  // ========== 行号切换 ==========
  const toggleLineNumbers = (): void => {
    if (!view.value) return;
    showLineNumbers.value = !showLineNumbers.value;
    // 通过 CSS 类切换行号显示/隐藏
    const editorElement = view.value.dom;
    if (showLineNumbers.value) {
      editorElement.classList.remove('cm-hide-line-numbers');
    } else {
      editorElement.classList.add('cm-hide-line-numbers');
    }
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
    showLineNumbers,
    content,

    // 核心操作
    createEditor,
    switchMode,
    getContent,
    setContent,
    destroy,
    toggleLineNumbers,

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
