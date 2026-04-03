/**
 * 编辑器核心创建函数
 * @module core/editor
 * @description 提供编辑器状态和视图的创建功能
 */

import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  headingDecorator,
  emphasisDecorator,
  linkDecorator,
  codeDecorator,
  taskListDecorator,
  listDecorator,
  mathDecorator,
  diagramDecorator,
} from './decorators';
import type { EditorMode } from '../types';

/**
 * 创建 IR 模式装饰器
 */
const createIRDecorators = (): Extension[] => {
  return [
    headingDecorator(),
    emphasisDecorator(),
    linkDecorator(),
    codeDecorator(),
    taskListDecorator(),
    listDecorator(),
    // v6: IR 模式下直接预览数学公式与 Mermaid
    mathDecorator(),
    diagramDecorator(),
  ];
};

/**
 * 覆盖 CM6 默认的删除线高亮 — 强制使用 line-through solid
 */
const strikethroughOverride = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: tags.strikethrough,
      textDecoration: 'line-through',
    },
  ])
);

/**
 * 创建基础扩展配置
 */
export const createBaseExtensions = (mode: EditorMode): Extension[] => {
  const extensions: Extension[] = [
    minimalSetup,
    // Markdown 解析
    markdown({
      strikethrough: true,  // 启用删除线支持
    }),
  ];

  // IR 模式：应用删除线样式覆盖 + 装饰器
  if (mode === 'ir') {
    extensions.push(strikethroughOverride);
    extensions.push(...createIRDecorators());
  }

  // 源码模式使用等宽字体
  if (mode === 'source') {
    extensions.push(EditorView.theme({
      '.cm-content': {
        fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
      },
    }));
  }

  // 行号通过 CSS 类切换（默认显示）
  // extensions.push(lineNumbers());

  return extensions;
};

/**
 * 创建编辑器状态
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
 */
export const destroyEditor = (view: EditorView | null): void => {
  if (view) {
    view.destroy();
  }
};
