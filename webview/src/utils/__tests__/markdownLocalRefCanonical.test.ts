import { describe, expect, it } from 'vitest';
import { canonicalMarkdownLocalRefKey } from '../markdownLocalRefCanonical';

describe('canonicalMarkdownLocalRefKey', () => {
  it('unifies dots and slashes', () => {
    expect(canonicalMarkdownLocalRefKey('./assets/./x.png')).toBe(canonicalMarkdownLocalRefKey('assets/x.png'));
  });

  it('collapses ../ within path', () => {
    expect(canonicalMarkdownLocalRefKey('assets/../assets/z.png')).toBe(canonicalMarkdownLocalRefKey('./assets/z.png'));
  });

  it('supports percent-encoded segments', () => {
    expect(canonicalMarkdownLocalRefKey('./assets/a%20b.png')).toBe(canonicalMarkdownLocalRefKey('assets/a b.png'));
  });

  it('strips query and hash suffixes before normalize', () => {
    expect(canonicalMarkdownLocalRefKey('./assets/x.png?v=1#h')).toBe('assets/x.png');
  });

  it('M181 lowercases for case-insensitive comparison', () => {
    expect(canonicalMarkdownLocalRefKey('./Assets/Logo.PNG')).toBe('assets/logo.png');
  });
});
