import { describe, it, expect } from 'vitest';
import {
  getRichPerfTier,
  RICH_PERF_T1_CHARS,
  RICH_PERF_T1_LINES,
  RICH_PERF_T2_CHARS,
  RICH_PERF_T2_LINES,
} from '../richPerfTier';

function linesText(n: number): string {
  return new Array(n).fill('x').join('\n');
}

describe('getRichPerfTier', () => {
  it('档 0：小文档', () => {
    expect(getRichPerfTier('hello')).toBe(0);
    expect(getRichPerfTier('a'.repeat(1000))).toBe(0);
  });

  it('档 1：超过 T1 字符', () => {
    expect(getRichPerfTier('a'.repeat(RICH_PERF_T1_CHARS + 1))).toBe(1);
  });

  it('档 2：超过 T2 字符', () => {
    expect(getRichPerfTier('a'.repeat(RICH_PERF_T2_CHARS + 1))).toBe(2);
  });

  it('档 1：超过 T1 行数', () => {
    expect(getRichPerfTier(linesText(RICH_PERF_T1_LINES + 1))).toBe(1);
  });

  it('档 2：超过 T2 行数', () => {
    expect(getRichPerfTier(linesText(RICH_PERF_T2_LINES + 1))).toBe(2);
  });

  it('空串为档 0', () => {
    expect(getRichPerfTier('')).toBe(0);
  });
});
