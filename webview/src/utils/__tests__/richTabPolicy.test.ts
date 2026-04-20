import { afterEach, describe, expect, it } from 'vitest';
import { shouldAppHandleTabIndent } from '../richTabPolicy';

describe('richTabPolicy', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  it('does not let App steal Tab in rich mode', () => {
    expect(shouldAppHandleTabIndent({ mode: 'rich', key: 'Tab', target: document.body })).toBe(false);
  });

  it('does not steal Tab when focus is inside form fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(shouldAppHandleTabIndent({ mode: 'ir', key: 'Tab', target: input })).toBe(false);
  });

  it('does not steal Tab when Milkdown ProseMirror is focused (even if mode is not rich)', () => {
    const root = document.createElement('div');
    root.className = 'milkdown-editor';
    const pm = document.createElement('div');
    pm.className = 'ProseMirror';
    pm.setAttribute('tabindex', '0');
    root.appendChild(pm);
    document.body.appendChild(root);
    pm.focus();

    expect(shouldAppHandleTabIndent({ mode: 'ir', key: 'Tab', target: pm })).toBe(false);
  });

  it('allows App Tab indent handling in IR when editor surface is focused', () => {
    const div = document.createElement('div');
    div.setAttribute('tabindex', '0');
    document.body.appendChild(div);
    div.focus();
    expect(shouldAppHandleTabIndent({ mode: 'ir', key: 'Tab', target: div })).toBe(true);
  });
});
