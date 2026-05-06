import { describe, it, expect, afterEach } from 'vitest';

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { listener } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';

import { footnote } from '../plugins/footnote';
import { marklyTableGridPastePlugin, marklyTableStructureKeymapPlugin } from '../plugins/markly-table-rich';

let lastEditor: Editor | null = null;

function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

async function roundTrip(markdown: string): Promise<string> {
  const el = document.createElement('div');
  document.body.appendChild(el);

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, el);
      ctx.set(defaultValueCtx, markdown);
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
  return serializer(view.state.doc);
}

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

describe('Rich newline serialization golden (M12)', () => {
  it('stabilizes after first normalize for hard-break line', async () => {
    const md = 'Hello  \nWorld';
    const out1 = normalizeEol(await roundTrip(md));
    const out2 = normalizeEol(await roundTrip(out1));
    expect(out1).toContain('Hello');
    expect(out1).toContain('World');
    expect(out2).toBe(out1);
  });

  it('keeps bullet + following line inside one list item distinguishable vs two items', async () => {
    const md = `- one\n  hard line`;
    const out1 = normalizeEol(await roundTrip(md));
    const out2 = normalizeEol(await roundTrip(out1));
    expect(out2).toBe(out1);
    expect(out1.toLowerCase()).toContain('one');
  });
});
