/**
 * M15：jsdom / Vitest 无法端到端还原浏览器 IME composition。
 * 本文件只做「管线不抛错」级别的烟雾测试；真机 IME 仍以手动或 ExTester 场景为准。
 * 详见 docs/RICH_IME_MANUAL.md。
 */
import { describe, it, expect, afterEach } from 'vitest';

import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { listener } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';

import { footnote } from '../plugins/footnote';
import { marklyRichListIndentKeymapPlugin, marklyTableGridPastePlugin, marklyTableStructureKeymapPlugin } from '../plugins/markly-table-rich';

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

describe('Rich IME composition smoke (M15)', () => {
  it('handles compositionstart/update/end without throwing on prose mirror surface', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, el);
        ctx.set(defaultValueCtx, '测试');
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
    const surface = view.dom.querySelector('.ProseMirror') ?? view.dom;

    const fire = (type: string, data?: string) => {
      const Ctor = typeof CompositionEvent !== 'undefined' ? CompositionEvent : Event;
      const ev = new Ctor(type, { bubbles: true, cancelable: true, ...(data != null ? { data } : {}) } as any);
      surface.dispatchEvent(ev);
    };

    expect(() => {
      fire('compositionstart', '');
      fire('compositionupdate', 'n');
      fire('compositionend', 'nihao');
    }).not.toThrow();
  });
});
