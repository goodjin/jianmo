/**
 * 围栏代码块装饰器（``` fenced code）
 * @module core/decorators/codeBlock
 * @description IR 模式下将 fenced code block 替换为可视化代码块；光标进入时回退源码便于编辑。
 */

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Extension, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { DecoratorOptions } from '../../types/decorator';
import { openSourceAtRangeEffect, type OpenSourceRange } from './openSourceEffect';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function selectionIntersects(from: number, to: number, selFrom: number, selTo: number): boolean {
  return !(selTo < from || selFrom > to);
}

function parseFenced(md: string): { info: string; code: string } {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 0) return { info: '', code: md };
  const first = lines[0] ?? '';
  const info = first.replace(/^```+/, '').trim();
  // 去掉首尾 fence 行
  const bodyLines = lines.slice(1);
  if (bodyLines.length > 0 && /^```+/.test(bodyLines[bodyLines.length - 1] ?? '')) {
    bodyLines.pop();
  }
  // 保留原始缩进与空行
  const code = bodyLines.join('\n').replace(/\n+$/, '');
  return { info, code };
}

class CodeBlockWidget extends WidgetType {
  constructor(
    private fencedMarkdown: string,
    private from: number,
    private to: number
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-codeblock';
    wrap.setAttribute('data-markly-src-from', String(this.from));
    wrap.setAttribute('data-markly-src-to', String(this.to));

    const { info, code } = parseFenced(this.fencedMarkdown);

    const header = document.createElement('div');
    header.className = 'cm-codeblock-header';

    const lang = document.createElement('span');
    lang.className = 'cm-codeblock-lang';
    lang.textContent = info || 'code';
    header.appendChild(lang);

    const pre = document.createElement('pre');
    pre.className = 'cm-codeblock-body';
    const codeEl = document.createElement('code');
    codeEl.innerHTML = escapeHtml(code);
    pre.appendChild(codeEl);

    wrap.appendChild(header);
    wrap.appendChild(pre);
    return wrap;
  }

  eq(other: CodeBlockWidget): boolean {
    return other.fencedMarkdown === this.fencedMarkdown && other.from === this.from && other.to === this.to;
  }
}

function computeCodeBlockDecorations(state: EditorView['state'], opened: OpenSourceRange | null): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  const t = doc.sliceString(0, doc.length);
  if (!t.includes('```')) return Decoration.set([]);

  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;

  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      // lezer markdownLanguage: fenced code node is typically "FencedCode"
      if (node.type.name !== 'FencedCode') return;
      const from = node.from;
      const to = node.to;
      if (opened && opened.from === from && opened.to === to) return;
      if (selectionIntersects(from, to, selFrom, selTo)) return;
      const md = doc.sliceString(from, to);
      decorations.push(
        Decoration.replace({
          widget: new CodeBlockWidget(md, from, to),
          block: true,
          inclusive: false,
        }).range(from, to)
      );
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return computeCodeBlockDecorations(state, null);
  },
  update(decos, tr) {
    let opened: OpenSourceRange | null = null;
    for (const e of tr.effects) {
      if (e.is(openSourceAtRangeEffect)) opened = e.value;
    }
    if (!tr.docChanged && !tr.selectionSet && !opened) return decos;
    return computeCodeBlockDecorations(tr.state, opened);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const codeBlockDecorator = (_options: DecoratorOptions = {}): Extension => {
  return codeBlockField;
};

