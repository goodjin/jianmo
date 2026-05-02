import { describe, expect, it } from 'vitest';
import { mockRewriteSelection } from '../mockRewriteSelection';

describe('mockRewriteSelection', () => {
  it('capitalizes first grapheme and appends Chinese period when sentence lacks ending punctuation', () => {
    expect(mockRewriteSelection(' hello')).toBe('Hello。');
    expect(mockRewriteSelection('already ends.')).toBe('Already ends.');
    expect(mockRewriteSelection('已有句号。')).toBe('已有句号。');
  });

  it('returns empty for whitespace-only input', () => {
    expect(mockRewriteSelection(' \t\n')).toBe('');
  });
});
