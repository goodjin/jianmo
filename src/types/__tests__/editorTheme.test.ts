import { describe, expect, it } from 'vitest';
import {
  EDITOR_PALETTE_IDS,
  isEditorPaletteId,
  isEditorThemeSetting,
  resolveEditorPaletteId,
  isDarkEditorThemeSetting,
} from '../editorTheme';

describe('editorTheme', () => {
  it('exposes 10 selectable palettes', () => {
    expect(EDITOR_PALETTE_IDS).toHaveLength(10);
  });

  it('accepts legacy and named settings', () => {
    expect(isEditorThemeSetting('auto')).toBe(true);
    expect(isEditorThemeSetting('light')).toBe(true);
    expect(isEditorThemeSetting('dark')).toBe(true);
    expect(isEditorThemeSetting('nord')).toBe(true);
    expect(isEditorThemeSetting('neon')).toBe(false);
    expect(isEditorPaletteId('auto')).toBe(false);
    expect(isEditorPaletteId('tokyo-night')).toBe(true);
  });

  it('resolves auto/light/dark to palettes', () => {
    expect(resolveEditorPaletteId('auto', false)).toBe('github-light');
    expect(resolveEditorPaletteId('auto', true)).toBe('github-dark');
    expect(resolveEditorPaletteId('light', true)).toBe('github-light');
    expect(resolveEditorPaletteId('dark', false)).toBe('vscode-dark');
    expect(resolveEditorPaletteId('dracula', false)).toBe('dracula');
  });

  it('classifies dark vs light', () => {
    expect(isDarkEditorThemeSetting('nord', false)).toBe(true);
    expect(isDarkEditorThemeSetting('github-light', true)).toBe(false);
    expect(isDarkEditorThemeSetting('auto', true)).toBe(true);
    expect(isDarkEditorThemeSetting('auto', false)).toBe(false);
  });
});
