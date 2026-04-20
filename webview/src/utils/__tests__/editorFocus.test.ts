import { afterEach, describe, expect, it } from 'vitest';
import { isFormFieldKeyEventTarget, isMilkdownProseMirrorFocused } from '../editorFocus';

describe('editorFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error jsdom allows nulling activeElement via blur on body in most cases
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  it('isFormFieldKeyEventTarget detects native form controls', () => {
    const input = document.createElement('input');
    expect(isFormFieldKeyEventTarget(input)).toBe(true);
  });

  it('isFormFieldKeyEventTarget detects contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isFormFieldKeyEventTarget(div)).toBe(true);
  });

  it('isFormFieldKeyEventTarget detects nested controls via closest()', () => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const inner = document.createElement('span');
    inner.textContent = 'x';
    label.appendChild(inner);
    label.appendChild(input);
    expect(isFormFieldKeyEventTarget(inner)).toBe(true);
  });

  it('isMilkdownProseMirrorFocused is true only when ProseMirror itself is focused', () => {
    const root = document.createElement('div');
    root.className = 'milkdown-editor';
    const pm = document.createElement('div');
    pm.className = 'ProseMirror';
    pm.setAttribute('tabindex', '0');
    root.appendChild(pm);
    document.body.appendChild(root);

    expect(isMilkdownProseMirrorFocused()).toBe(false);

    pm.focus();
    expect(document.activeElement).toBe(pm);
    expect(isMilkdownProseMirrorFocused()).toBe(true);
  });
});
