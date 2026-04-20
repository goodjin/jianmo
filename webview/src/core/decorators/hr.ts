/**
 * 分割线装饰器（HorizontalRule）
 * @module core/decorators/hr
 * @description IR 模式下将 ---/*** 等分割线替换为可视化横线；光标进入时回退源码便于编辑。
 */

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Extension, type Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { DecoratorOptions } from '../../types/decorator';
import { openSourceAtRangeEffect, type OpenSourceRange } from './openSourceEffect';

class HrWidget extends WidgetType {
  constructor(
    private from: number,
    private to: number
  ) {
    super();
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-hr';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-label', 'horizontal rule');
    el.setAttribute('data-markly-src-from', String(this.from));
    el.setAttribute('data-markly-src-to', String(this.to));
    return el;
  }
}

function selectionIntersects(from: number, to: number, selFrom: number, selTo: number): boolean {
  return !(selTo < from || selFrom > to);
}

function computeHrDecorations(state: EditorView['state'], opened: OpenSourceRange | null): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  const t = doc.sliceString(0, doc.length);
  if (!t.includes('-') && !t.includes('*')) return Decoration.set([]);

  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;

  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.type.name !== 'HorizontalRule') return;
      const from = node.from;
      const to = node.to;
      if (opened && opened.from === from && opened.to === to) return;
      if (selectionIntersects(from, to, selFrom, selTo)) return;
      decorations.push(
        Decoration.replace({
          widget: new HrWidget(from, to),
          block: true,
          inclusive: false,
        }).range(from, to)
      );
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const hrField = StateField.define<DecorationSet>({
  create(state) {
    return computeHrDecorations(state, null);
  },
  update(decos, tr) {
    let opened: OpenSourceRange | null = null;
    for (const e of tr.effects) {
      if (e.is(openSourceAtRangeEffect)) opened = e.value;
    }
    if (!tr.docChanged && !tr.selectionSet && !opened) return decos;
    return computeHrDecorations(tr.state, opened);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const hrDecorator = (_options: DecoratorOptions = {}): Extension => {
  return hrField;
};

