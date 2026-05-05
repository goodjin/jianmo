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
import { HighlightStyle, syntaxHighlighting, foldGutter, foldService } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { openSourceAtRangeEffect } from './decorators/openSourceEffect';
import { computeMarkdownHeadingFoldRange } from './markdownFolding';
import {
  headingDecorator,
  emphasisDecorator,
  linkDecorator,
  codeDecorator,
  codeBlockDecorator,
  taskListDecorator,
  listDecorator,
  hrDecorator,
  tableDecorator,
  tocDecorator,
  footnoteDecorator,
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
    codeBlockDecorator(),
    taskListDecorator(),
    listDecorator(),
    hrDecorator(),
    tocDecorator(),
    footnoteDecorator(),
    tableDecorator(),
    // v6: IR 模式下直接预览数学公式与 Mermaid
    mathDecorator(),
    diagramDecorator(),
  ];
};

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
 * 点击可视化块时：将光标定位到其源码起点，触发“回退源码”逻辑。
 * 约定：widget 根节点带 data-markly-src-from / data-markly-src-to。
 */
const enterSourceWhenClickWidget = EditorView.domEventHandlers({
  mousedown: (e, view) => {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const el = target.closest('[data-markly-src-from]') as HTMLElement | null;
    if (!el) return false;
    const rawFrom = el.getAttribute('data-markly-src-from');
    if (!rawFrom) return false;
    const rawTo = el.getAttribute('data-markly-src-to');
    if (!rawTo) return false;
    const from = Number(rawFrom);
    const to = Number(rawTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    e.preventDefault();
    e.stopPropagation();
    // atomic range 内通常无法直接放置光标：用 effect 让装饰器主动回退源码
    view.dispatch({ effects: openSourceAtRangeEffect.of({ from, to }) });
    view.focus();
    return true;
  },
});

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
    enterSourceWhenClickWidget,
    focusEditorOnPointerDown,
    // Markdown 解析
    markdown({
      // 使用 GFM base：支持删除线、管道表格等扩展语法
      base: markdownLanguage,
    }),
  ];

  // M69：按标题折叠正文块（Source/IR）
  if (mode !== 'rich') {
    extensions.push(
      foldService.of((state, lineStart, _lineEnd) => computeMarkdownHeadingFoldRange(state, lineStart)),
      foldGutter()
    );
  }

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

  if (mode === 'source' || mode === 'ir') {
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
