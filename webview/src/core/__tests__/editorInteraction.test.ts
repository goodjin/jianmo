/**
 * 编辑器交互：点击聚焦等与 CM6 链在一起的逻辑
 * @vitest-environment jsdom
 *
 * 说明：jsdom 对 contenteditable 焦点模型不完整，故用 spy 验证会调用 view.focus()，
 * 而不断言 document.activeElement。
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createEditorState, createEditorView, destroyEditor } from '../editor';
import type { EditorView } from '@codemirror/view';

describe('editor focus on pointer down', () => {
  let container: HTMLDivElement;
  let view: EditorView;

  afterEach(() => {
    destroyEditor(view);
    view = null as unknown as EditorView;
    if (container?.parentNode) container.parentNode.removeChild(container);
  });

  it('在 .cm-content 上 mousedown 会调用 view.focus()', () => {
    container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '120px';
    document.body.appendChild(container);

    const state = createEditorState('hello', 'ir', []);
    view = createEditorView(container, state);

    const focusSpy = vi.spyOn(view, 'focus');

    view.contentDOM.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    );

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('IR 与 source 模式均注册同一聚焦行为（回归：勿只挂在单一 mode）', () => {
    for (const mode of ['ir', 'source'] as const) {
      const c = document.createElement('div');
      c.style.width = '100px';
      c.style.height = '80px';
      document.body.appendChild(c);

      const st = createEditorState('x', mode, []);
      const v = createEditorView(c, st);
      const spy = vi.spyOn(v, 'focus');
      v.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(spy).toHaveBeenCalledTimes(1);
      destroyEditor(v);
      c.remove();
    }
  });
});
