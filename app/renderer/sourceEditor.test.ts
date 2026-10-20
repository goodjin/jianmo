import { describe, expect, it, vi } from 'vitest';
import { formatDocumentSource } from '../electron/sourceText';
import { mountSourceEditor } from './sourceEditor';

describe('mountSourceEditor', () => {
  it('打字、撤销、重做都作用在原文上，不会先排版', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const raw = '{"a":1}';
    const seen: string[] = [];
    const editor = mountSourceEditor(parent, raw, 16, (text) => {
      seen.push(text);
    });

    expect(editor.getContent()).toBe(raw);
    expect(editor.getContent()).not.toBe(formatDocumentSource(raw, 'a.json'));
    expect(editor.history()).toEqual({ canUndo: false, canRedo: false });

    const brace = raw.lastIndexOf('}');
    editor.view.dispatch({
      changes: { from: brace, insert: ', "b": 2' },
    });
    expect(editor.getContent()).toBe('{"a":1, "b": 2}');
    expect(editor.history().canUndo).toBe(true);
    expect(seen.at(-1)).toBe('{"a":1, "b": 2}');

    expect(editor.undo()).toBe(true);
    expect(editor.getContent()).toBe(raw);
    expect(editor.history()).toEqual({ canUndo: false, canRedo: true });

    expect(editor.redo()).toBe(true);
    expect(editor.getContent()).toBe('{"a":1, "b": 2}');

    editor.destroy();
    expect(parent.querySelector('.source-editor-mount')).toBeNull();
  });

  it('撤销没有步骤时返回 false，正文不动', () => {
    const parent = document.createElement('div');
    const onChange = vi.fn();
    const editor = mountSourceEditor(parent, 'abc\r\n', 14, onChange);
    expect(editor.undo()).toBe(false);
    expect(editor.redo()).toBe(false);
    expect(editor.getContent()).toBe('abc\r\n');
    expect(onChange).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('Windows 换行和文件头标记按原样留着，普通换行不会被改成回车换行', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const crlf = mountSourceEditor(parent, '\uFEFF{"a":1}\r\n\r\n', 14, () => undefined);
    expect(crlf.getContent()).toBe('\uFEFF{"a":1}\r\n\r\n');
    crlf.view.dispatch({ changes: { from: crlf.view.state.doc.length, insert: 'x\n' } });
    expect(crlf.getContent()).toBe('\uFEFF{"a":1}\r\n\r\nx\r\n');
    crlf.destroy();

    const lf = mountSourceEditor(parent, 'a\nb\n', 14, () => undefined);
    expect(lf.getContent()).toBe('a\nb\n');
    lf.destroy();
    parent.remove();
  });

  it('默认自动换行，关掉后长行不再折', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const editor = mountSourceEditor(parent, 'hello', 14, () => undefined);
    expect(editor.view.contentDOM.classList.contains('cm-lineWrapping')).toBe(true);
    editor.setWordWrap(false);
    expect(editor.view.contentDOM.classList.contains('cm-lineWrapping')).toBe(false);
    editor.setWordWrap(true);
    expect(editor.view.contentDOM.classList.contains('cm-lineWrapping')).toBe(true);
    editor.destroy();
    parent.remove();
  });
});
