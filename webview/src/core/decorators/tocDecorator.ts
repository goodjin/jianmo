/**
 * TOC 标记装饰器（<!-- TOC --> ... <!-- /TOC -->）
 * @module core/decorators/tocDecorator
 * @description IR 模式下将 TOC 标记替换为占位卡片；光标进入时回退源码便于编辑。
 */

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Extension, type Range } from '@codemirror/state';
import type { DecoratorOptions } from '../../types/decorator';
import { TOC_REGEX } from '../../utils/toc';
import { openSourceAtRangeEffect, type OpenSourceRange } from './openSourceEffect';

class TocWidget extends WidgetType {
  constructor(
    private from: number,
    private to: number
  ) {
    super();
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-toc-card';
    el.setAttribute('data-markly-src-from', String(this.from));
    el.setAttribute('data-markly-src-to', String(this.to));

    const title = document.createElement('div');
    title.className = 'cm-toc-title';
    title.textContent = '目录（TOC）';

    const desc = document.createElement('div');
    desc.className = 'cm-toc-desc';
    desc.textContent = '保存/导出时会根据当前标题自动更新。将光标移入可编辑源码。';

    el.appendChild(title);
    el.appendChild(desc);
    return el;
  }
}

function selectionIntersects(from: number, to: number, selFrom: number, selTo: number): boolean {
  return !(selTo < from || selFrom > to);
}

function computeTocDecorations(state: EditorView['state'], opened: OpenSourceRange | null): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  const t = doc.sliceString(0, doc.length);
  if (!t.includes('TOC')) return Decoration.set([]);

  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;

  // TOC_REGEX 不是 global，这里用循环 slice 方式多次匹配
  let offset = 0;
  while (offset < t.length) {
    const slice = t.slice(offset);
    const m = TOC_REGEX.exec(slice);
    if (!m || m.index == null) break;
    const from = offset + m.index;
    const to = from + m[0].length;
    // reset lastIndex，避免 sticky 行为
    (TOC_REGEX as any).lastIndex = 0;

    if (opened && opened.from === from && opened.to === to) {
      // clicked to edit source; skip replacing this range
    } else if (!selectionIntersects(from, to, selFrom, selTo)) {
      decorations.push(
        Decoration.replace({
          widget: new TocWidget(from, to),
          block: true,
          inclusive: false,
        }).range(from, to)
      );
    }

    offset = to;
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const tocField = StateField.define<DecorationSet>({
  create(state) {
    return computeTocDecorations(state, null);
  },
  update(decos, tr) {
    let opened: OpenSourceRange | null = null;
    for (const e of tr.effects) {
      if (e.is(openSourceAtRangeEffect)) opened = e.value;
    }
    if (!tr.docChanged && !tr.selectionSet && !opened) return decos;
    return computeTocDecorations(tr.state, opened);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const tocDecorator = (_options: DecoratorOptions = {}): Extension => {
  return tocField;
};

