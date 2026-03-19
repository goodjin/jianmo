/**
 * 编辑器核心创建函数
 * @module core/editor
 * @description 提供编辑器状态和视图的创建功能
 */

import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { EditorMode } from '../types';

/**
 * 创建基础扩展配置
 * @param mode - 编辑器模式
 * @returns CodeMirror 扩展数组
 */
export const createBaseExtensions = (mode: EditorMode): Extension[] => {
  const extensions: Extension[] = [
    basicSetup,
    markdown(),
  ];

  // 根据模式添加不同扩展
  switch (mode) {
    case 'ir':
      // 即时渲染模式：添加装饰器（后续由 Decorator System 模块提供）
      extensions.push(EditorView.theme({
        '.cm-content': {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }));
      break;

    case 'source':
      // 源码模式：语法高亮
      extensions.push(EditorView.theme({
        '.cm-content': {
          fontFamily: '"Fira Code", "JetBrains Mono", monospace',
        },
      }));
      break;

    case 'split':
      // 分屏模式：简化装饰
      extensions.push(EditorView.theme({
        '.cm-content': {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }));
      break;
  }

  return extensions;
};

/**
 * 创建编辑器状态
 * @param content - 初始内容
 * @param mode - 编辑器模式
 * @param extensions - 额外的扩展
 * @returns EditorState 实例
 */
export const createEditorState = (
  content: string,
  mode: EditorMode,
  extensions: Extension[] = []
): EditorState => {
  return EditorState.create({
    doc: content,
    extensions: [
      ...createBaseExtensions(mode),
      ...extensions,
    ],
  });
};

/**
 * 创建编辑器视图
 * @param container - 容器元素
 * @param state - 编辑器状态
 * @returns EditorView 实例
 */
export const createEditorView = (
  container: HTMLElement,
  state: EditorState
): EditorView => {
  return new EditorView({
    state,
    parent: container,
  });
};

/**
 * 销毁编辑器
 * @param view - 编辑器视图实例
 */
export const destroyEditor = (view: EditorView | null): void => {
  if (view) {
    view.destroy();
  }
};
