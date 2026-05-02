import { describe, expect, it } from 'vitest';
import { patternToRegExp, countAllMatchesInText } from '../findPattern';

describe('countAllMatchesInText', () => {
  it('counts matches without allocating match ranges', () => {
    const re = patternToRegExp('a', { caseSensitive: true, patternMode: 'literal' })!;
    const r = countAllMatchesInText('a a a', re, 1000);
    expect(r.count).toBe(3);
    expect(r.timedOut).toBe(false);
  });

  it('returns lower bound when time budget exceeded', () => {
    const re = patternToRegExp('a', { caseSensitive: true, patternMode: 'literal' })!;
    const big = 'a'.repeat(200_000);
    const r = countAllMatchesInText(big, re, 0);
    expect(r.count).toBeGreaterThan(0);
    expect(r.timedOut).toBe(true);
  });
});

