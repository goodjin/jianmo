/**
 * 编辑器核心创建函数
 * @module core/editor
 * @description 提供编辑器状态和视图的创建功能
 */

import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdownToClipboardHtml } from '../utils/richClipboard';
import { minimalSetup } from 'codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { foldGutter, foldService } from '@codemirror/language';
import { computeMarkdownHeadingFoldRange } from './markdownFolding';
import type { EditorMode } from '../types';

/** 点击编辑区时主动 focus，避免 webview 内偶发不显示插入光标 */
const focusEditorOnPointerDown = EditorView.domEventHandlers({
  mousedown: (_e, view) => {
    view.focus();
  },
});

/** M87：源码/IR 复制时附带 HTML，便于邮件/IM 粘贴 */
const richClipboardCopyCm = EditorView.domEventHandlers({
  copy(event, view) {
    const cd = event.clipboardData;
    if (!cd) return false;
    const sel = view.state.selection.main;
    if (sel.empty) return false;
    const md = view.state.sliceDoc(sel.from, sel.to);
    if (!md) return false;
    event.preventDefault();
    cd.setData('text/plain', md);
    cd.setData('text/html', markdownToClipboardHtml(md));
    return true;
  },
});

/**
 * 创建基础扩展配置
 */
export const createBaseExtensions = (mode: EditorMode): Extension[] => {
  const extensions: Extension[] = [
    minimalSetup,
    focusEditorOnPointerDown,
    // Markdown 解析
    markdown({
      // 使用 GFM base：支持删除线、管道表格等扩展语法
      base: markdownLanguage,
    }),
  ];

  // M69：按标题折叠正文块（Source）
  if (mode !== 'rich') {
    extensions.push(
      foldService.of((state, lineStart, _lineEnd) => computeMarkdownHeadingFoldRange(state, lineStart)),
      foldGutter()
    );
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

  if (mode === 'source') {
    extensions.push(richClipboardCopyCm);
  }

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
