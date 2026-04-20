/**
 * 表格装饰器（GFM pipe table）
 * @module core/decorators/table
 * @description IR 模式下将 `|...|` 管道表格替换为可视化表格。
 *
 * 约束：
 * - 当光标/选区落在表格范围内时，回退为源码（便于编辑）
 * - 依赖 markdownLanguage（GFM）提供 Table 语法节点
 */

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Extension, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { DecoratorOptions } from '../../types/decorator';
import { openSourceAtRangeEffect, type OpenSourceRange } from './openSourceEffect';

type Align = 'left' | 'center' | 'right';

function parseAlignmentRow(line: string, cols: number): Align[] {
  const parts = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((s) => s.trim());

  const out: Align[] = [];
  for (let i = 0; i < cols; i++) {
    const raw = (parts[i] ?? '').replace(/\s+/g, '');
    const left = raw.startsWith(':');
    const right = raw.endsWith(':');
    if (left && right) out.push('center');
    else if (right) out.push('right');
    else out.push('left');
  }
  return out;
}

function splitTableLine(line: string): string[] {
  const trimmed = line.trim();
  const core = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return core.split('|').map((c) => c.trim());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class TableWidget extends WidgetType {
  constructor(
    private tableMarkdown: string,
    private from: number,
    private to: number
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';
    wrap.setAttribute('data-markly-src-from', String(this.from));
    wrap.setAttribute('data-markly-src-to', String(this.to));

    const table = document.createElement('table');
    table.className = 'cm-table';

    const lines = this.tableMarkdown
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      wrap.textContent = this.tableMarkdown;
      wrap.classList.add('cm-table-error');
      return wrap;
    }

    const header = splitTableLine(lines[0]);
    const alignments = parseAlignmentRow(lines[1], header.length);

    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');
    for (let i = 0; i < header.length; i++) {
      const th = document.createElement('th');
      th.innerHTML = escapeHtml(header[i] ?? '');
      th.dataset.align = alignments[i] ?? 'left';
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 2; r < lines.length; r++) {
      const rowCells = splitTableLine(lines[r]);
      const tr = document.createElement('tr');
      for (let c = 0; c < header.length; c++) {
        const td = document.createElement('td');
        td.innerHTML = escapeHtml(rowCells[c] ?? '');
        td.dataset.align = alignments[c] ?? 'left';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    wrap.appendChild(table);
    return wrap;
  }

  eq(other: TableWidget): boolean {
    return other.tableMarkdown === this.tableMarkdown && other.from === this.from && other.to === this.to;
  }
}

function selectionIntersects(from: number, to: number, selFrom: number, selTo: number): boolean {
  // selTo==selFrom 也算交叉（光标在范围内）
  return !(selTo < from || selFrom > to);
}

function computeTableDecorations(state: EditorView['state'], opened: OpenSourceRange | null): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  const doc = state.doc;
  const t = doc.sliceString(0, doc.length);
  // 快速短路：无管道符就不可能有 pipe table
  if (!t.includes('|')) return Decoration.set([]);

  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;

  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.type.name !== 'Table') return;

      const from = node.from;
      const to = node.to;

      if (opened && opened.from === from && opened.to === to) return;
      // 光标在表格内：回退源码可编辑
      if (selectionIntersects(from, to, selFrom, selTo)) return;

      const md = doc.sliceString(from, to);
      decorations.push(
        Decoration.replace({
          widget: new TableWidget(md, from, to),
          block: true,
          inclusive: false,
        }).range(from, to)
      );
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const tableField = StateField.define<DecorationSet>({
  create(state) {
    return computeTableDecorations(state, null);
  },
  update(decos, tr) {
    // docChanged 或 selectionSet 都可能改变“是否回退源码”的判断
    let opened: OpenSourceRange | null = null;
    for (const e of tr.effects) {
      if (e.is(openSourceAtRangeEffect)) opened = e.value;
    }
    if (!tr.docChanged && !tr.selectionSet && !opened) return decos;
    return computeTableDecorations(tr.state, opened);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const tableDecorator = (_options: DecoratorOptions = {}): Extension => {
  return tableField;
};

