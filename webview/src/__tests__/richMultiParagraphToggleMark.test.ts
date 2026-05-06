import { describe, it, expect, afterEach } from 'vitest';

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { listener } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { TextSelection } from '@milkdown/prose/state';
import { toggleMark } from '@milkdown/prose/commands';

import { footnote } from '../plugins/footnote';
import { marklyTableGridPastePlugin, marklyTableStructureKeymapPlugin } from '../plugins/markly-table-rich';

let lastEditor: Editor | null = null;

afterEach(async () => {
  try {
    lastEditor?.destroy();
  } catch {
    // ignore
  } finally {
    lastEditor = null;
  }
  document.body.innerHTML = '';
});

describe('Rich multi-paragraph marks (M19)', () => {
  it('applies bold in document order when selection spans two paragraphs', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const md = 'Paragraph one\n\nParagraph two\n';
    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, el);
        ctx.set(defaultValueCtx, md);
      })
      .use(commonmark)
      .use(gfm)
      .use(columnResizingPlugin)
      .use(marklyTableStructureKeymapPlugin)
      .use(marklyTableGridPastePlugin)
      .use(footnote)
      .use(listener)
      .use(history)
      .create();

    lastEditor = editor;
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    let firstFrom = -1;
    let lastTo = -1;
    view.state.doc.descendants((node, pos) => {
      if (!node.isText) return true;
      const t = node.text ?? '';
      const idxOne = t.indexOf('Paragraph one');
      const idxTwo = t.indexOf('Paragraph two');
      if (idxOne >= 0) firstFrom = firstFrom === -1 ? pos + idxOne : Math.min(firstFrom, pos + idxOne);
      if (idxTwo >= 0) lastTo = Math.max(lastTo, pos + idxTwo + 'Paragraph two'.length);
      return true;
    });
    expect(firstFrom).toBeGreaterThanOrEqual(1);
    expect(lastTo).toBeGreaterThan(firstFrom);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstFrom, lastTo)));
    const strong = view.state.schema.marks.strong;
    expect(strong).toBeTruthy();

    toggleMark(strong!)(view.state, view.dispatch);
    const out = serializer(view.state.doc);
    expect(out.indexOf('**Paragraph one**')).toBeLessThan(out.indexOf('**Paragraph two**'));
  });
});
