/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { applyEditorPalette, EDITOR_PALETTES, getEditorPalette, resolveEditorPalette } from '../themeConfig';

describe('themeConfig palettes', () => {
  it('defines 10 named palettes with unique ids', () => {
    expect(EDITOR_PALETTES).toHaveLength(10);
    const ids = EDITOR_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(10);
  });

  it('resolves named and legacy settings', () => {
    expect(resolveEditorPalette('nord', false).id).toBe('nord');
    expect(resolveEditorPalette('auto', true).id).toBe('github-dark');
    expect(resolveEditorPalette('light', true).id).toBe('github-light');
  });

  it('applies CSS variables and data attributes', () => {
    const el = document.createElement('div');
    applyEditorPalette(el, getEditorPalette('dracula'));
    expect(el.style.getPropertyValue('--vscode-editor-background')).toBe('#282a36');
    expect(el.style.getPropertyValue('--markly-primary')).toBe('#bd93f9');
    expect(el.getAttribute('data-theme')).toBe('dark');
    expect(el.getAttribute('data-markly-palette')).toBe('dracula');
  });
});
