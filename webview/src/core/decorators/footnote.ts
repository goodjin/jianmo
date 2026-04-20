/**
 * 脚注装饰器（最小实现）
 * @module core/decorators/footnote
 * @description IR 模式下将脚注引用 `[^id]` 渲染为上标标签，将定义 `[^id]: ...` 渲染为脚注块。
 * 光标进入对应范围时回退源码便于编辑。
 */

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Extension, type Range } from '@codemirror/state';
import type { DecoratorOptions } from '../../types/decorator';
import { openSourceAtRangeEffect, type OpenSourceRange } from './openSourceEffect';

function selectionIntersects(from: number, to: number, selFrom: number, selTo: number): boolean {
  return !(selTo < from || selFrom > to);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class FootnoteRefWidget extends WidgetType {
  constructor(
    private id: string,
    private from: number,
    private to: number
  ) {
    super();
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-footnote-ref';
    el.textContent = this.id;
    el.setAttribute('aria-label', `footnote reference ${this.id}`);
    el.setAttribute('data-markly-src-from', String(this.from));
    el.setAttribute('data-markly-src-to', String(this.to));
    return el;
  }
  eq(other: FootnoteRefWidget): boolean {
    return other.id === this.id && other.from === this.from && other.to === this.to;
  }
}

class FootnoteDefWidget extends WidgetType {
  constructor(
    private id: string,
    private body: string,
    private from: number,
    private to: number
  ) {
    super();
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-footnote-def';
    wrap.setAttribute('data-markly-src-from', String(this.from));
    wrap.setAttribute('data-markly-src-to', String(this.to));

    const head = document.createElement('div');
    head.className = 'cm-footnote-def-id';
    head.textContent = `[^${this.id}]`;

    const body = document.createElement('div');
    body.className = 'cm-footnote-def-body';
    body.innerHTML = escapeHtml(this.body);

    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }
  eq(other: FootnoteDefWidget): boolean {
    return other.id === this.id && other.body === this.body && other.from === this.from && other.to === this.to;
  }
}

function computeFootnoteDecorations(state: EditorView['state'], opened: OpenSourceRange | null): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  const t = doc.sliceString(0, doc.length);
  if (!t.includes('[^')) return Decoration.set([]);

  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;

  // 避免匹配 fenced code 内的脚注：简单按 ``` 开关忽略行
  const lines = t.split('\n');
  let pos = 0;
  let inCode = false;

  // 先处理脚注定义（block），避免其内部的 [^id] 被当作引用再替换
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCode = !inCode;
      pos += line.length + 1;
      continue;
    }
    if (inCode) {
      pos += line.length + 1;
      continue;
    }

    const m = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    if (!m) {
      pos += line.length + 1;
      continue;
    }

    const id = m[1] ?? '';
    const startFrom = pos;

    const bodyLines: string[] = [];
    bodyLines.push(m[2] ?? '');

    let j = i + 1;
    let pos2 = pos + line.length + 1;
    while (j < lines.length) {
      const next = lines[j] ?? '';
      const nextTrim = next.trim();
      if (nextTrim.startsWith('```')) break;
      if (/^(?:\s{2,}|\t)/.test(next)) {
        bodyLines.push(next.replace(/^(?:\s{2,}|\t)/, ''));
        pos2 += next.length + 1;
        j++;
        continue;
      }
      break;
    }

    const endTo = pos2 - 1; // 去掉最后一个 \n
    if (opened && opened.from === startFrom && opened.to === endTo) {
      // clicked to edit source; skip replacing this range
    } else if (!selectionIntersects(startFrom, endTo, selFrom, selTo)) {
      decorations.push(
        Decoration.replace({
          widget: new FootnoteDefWidget(id, bodyLines.join('\n').trimEnd(), startFrom, endTo),
          block: true,
          inclusive: false,
        }).range(startFrom, endTo)
      );
    }

    // 跳过已消费的行
    i = j - 1;
    pos = pos2;
  }

  // 再处理引用（inline）
  inCode = false;
  pos = 0;
  let inDef = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCode = !inCode;
      pos += line.length + 1;
      continue;
    }
    if (!inCode) {
      // 跳过脚注定义块自身（避免把定义行/续行里的 [^id] 当成引用再渲染一遍）
      if (/^\[\^[^\]\s]+\]:/.test(line)) {
        inDef = true;
        pos += line.length + 1;
        continue;
      }
      if (inDef) {
        if (/^(?:\s{2,}|\t)/.test(line)) {
          pos += line.length + 1;
          continue;
        }
        inDef = false;
      }

      const re = /\[\^([^\]\s]+)\]/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(line)) !== null) {
        const id = mm[1] ?? '';
        const from = pos + mm.index;
        const to = from + mm[0].length;
        if (opened && opened.from === from && opened.to === to) continue;
        if (selectionIntersects(from, to, selFrom, selTo)) continue;
        decorations.push(
          Decoration.replace({
            widget: new FootnoteRefWidget(id, from, to),
            inclusive: false,
          }).range(from, to)
        );
      }
    }
    pos += line.length + 1;
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const footnoteField = StateField.define<DecorationSet>({
  create(state) {
    return computeFootnoteDecorations(state, null);
  },
  update(decos, tr) {
    let opened: OpenSourceRange | null = null;
    for (const e of tr.effects) {
      if (e.is(openSourceAtRangeEffect)) opened = e.value;
    }
    if (!tr.docChanged && !tr.selectionSet && !opened) return decos;
    return computeFootnoteDecorations(tr.state, opened);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const footnoteDecorator = (_options: DecoratorOptions = {}): Extension => {
  return footnoteField;
};

