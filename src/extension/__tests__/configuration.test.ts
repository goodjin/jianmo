import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: () => ({}),
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
  window: { showWarningMessage: vi.fn() },
}));

import { deepMerge, validateConfig } from '../configuration';
import type { ExtensionConfig } from '../../types';

const validConfig: ExtensionConfig = {
  editor: {
    theme: 'auto',
    fontSize: 14 as any,
    fontFamily: 'sans-serif',
    wrapPolicy: 'autoWrap',
    tableCellWrap: 'wrap',
    enableMermaid: true,
    enableShiki: false,
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000 as any,
    compressQuality: 0.8 as any,
  },
  export: {
    pdf: {
      format: 'A4',
      margin: { top: 25 as any, right: 20 as any, bottom: 25 as any, left: 20 as any },
    },
  },
};

describe('deepMerge', () => {
  it('preserves target defaults when source is empty', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('overrides with source values', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, { a: 10 });
    expect(result).toEqual({ a: 10, b: 2 });
  });

  it('deep merges nested objects', () => {
    const target = { nested: { x: 1, y: 2 } };
    const result = deepMerge(target, { nested: { x: 99 } } as any);
    expect(result).toEqual({ nested: { x: 99, y: 2 } });
  });

  it('does not mutate target', () => {
    const target = { a: 1 };
    const result = deepMerge(target, { a: 2 });
    expect(target.a).toBe(1);
    expect(result.a).toBe(2);
  });

  it('replaces arrays instead of merging them', () => {
    const target = { arr: [1, 2, 3] };
    const result = deepMerge(target, { arr: [4, 5] } as any);
    expect(result.arr).toEqual([4, 5]);
  });

  it('ignores undefined source values', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, { a: undefined } as any);
    expect(result.a).toBe(1);
  });

  it('handles real ExtensionConfig merging', () => {
    const defaults: ExtensionConfig = { ...validConfig };
    const user = { editor: { fontSize: 18 } } as any;
    const merged = deepMerge(defaults, user);
    expect(merged.editor.fontSize).toBe(18);
    expect(merged.editor.theme).toBe('auto');
    expect(merged.image.saveDirectory).toBe('./assets');
  });
});

describe('validateConfig', () => {
  it('returns valid for correct config', () => {
    const result = validateConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects fontSize < 8', () => {
    const cfg = deepMerge(validConfig, { editor: { fontSize: 4 } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('fontSize'))).toBe(true);
  });

  it('rejects fontSize > 72', () => {
    const cfg = deepMerge(validConfig, { editor: { fontSize: 100 } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid theme', () => {
    const cfg = deepMerge(validConfig, { editor: { theme: 'neon' } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('theme'))).toBe(true);
  });

  it('rejects compressThreshold <= 0', () => {
    const cfg = deepMerge(validConfig, { image: { compressThreshold: 0 } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('compressThreshold'))).toBe(true);
  });

  it('rejects compressQuality > 1', () => {
    const cfg = deepMerge(validConfig, { image: { compressQuality: 1.5 } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects compressQuality < 0', () => {
    const cfg = deepMerge(validConfig, { image: { compressQuality: -0.1 } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects empty saveDirectory', () => {
    const cfg = deepMerge(validConfig, { image: { saveDirectory: '  ' } } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('saveDirectory'))).toBe(true);
  });

  it('rejects invalid pdf format', () => {
    const cfg = deepMerge(validConfig, {
      export: { pdf: { format: 'B5' } },
    } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('format'))).toBe(true);
  });

  it('rejects negative margin', () => {
    const cfg = deepMerge(validConfig, {
      export: { pdf: { margin: { top: -5 } } },
    } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('margin.top'))).toBe(true);
  });

  it('rejects margin > 100', () => {
    const cfg = deepMerge(validConfig, {
      export: { pdf: { margin: { left: 200 } } },
    } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('margin.left'))).toBe(true);
  });

  it('collects multiple errors', () => {
    const cfg = deepMerge(validConfig, {
      editor: { fontSize: 1, theme: 'bad' },
    } as any);
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
