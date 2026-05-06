import { describe, it, expect, afterEach } from 'vitest';
import type { EditorView } from '@milkdown/prose/view';
import { TextSelection } from '@milkdown/prose/state';

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { listener } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';

import { footnote } from '../plugins/footnote';
import {
  marklyRichListIndentKeymapPlugin,
  marklyTableGridPastePlugin,
  marklyTableStructureKeymapPlugin,
} from '../plugins/markly-table-rich';

let lastEditor: Editor | null = null;

function fireKeyDown(view: EditorView, init: KeyboardEventInit): boolean {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  return Boolean(view.someProp('handleKeyDown', (h) => h(view, ev)));
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

describe('marklyRichListIndentKeymapPlugin (M11)', () => {
  it('indents second top-level bullet into nested list via Tab', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const md = '- a\n- b\n';
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
      .use(marklyRichListIndentKeymapPlugin)
      .use(footnote)
      .use(listener)
      .use(history)
      .create();

    lastEditor = editor;
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    let targetPos: number | null = null;
    view.state.doc.descendants((node, pos) => {
      if (targetPos != null) return false;
      if (node.isText && node.text === 'b') {
        targetPos = pos + 1;
        return false;
      }
      return true;
    });
    expect(targetPos).not.toBeNull();

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, targetPos!)));

    const handled = fireKeyDown(view, { key: 'Tab', code: 'Tab', keyCode: 9 });
    expect(handled).toBe(true);

    const out = serializer(view.state.doc);
    // Milkdown 可能将无序列表规范为 *；关注「子级缩进」与二级项仍在同一列表树下
    expect(out).toMatch(/\n\s+\*\s*b/);
    expect(out).toContain('a');
  });
});
