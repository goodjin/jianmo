/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { isSafeExternalHttpUrl, normalizeUrl } from '../url';

describe('normalizeUrl (M25)', () => {
  it('trims brackets and expands bare domain to https', () => {
    expect(normalizeUrl('  www.example.com/path  ')).toBe('https://www.example.com/path');
    expect(normalizeUrl('<https://example.com>')).toBe('https://example.com');
  });

  it('returns empty for javascript:, data:, vbscript:', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('');
    expect(normalizeUrl('data:text/html,<script>x</script>')).toBe('');
    expect(normalizeUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('returns empty for other schemes (mailto, file)', () => {
    expect(normalizeUrl('mailto:a@b.co')).toBe('');
    expect(normalizeUrl('file:///etc/passwd')).toBe('');
  });

  it('passes through http(s) unchanged', () => {
    expect(normalizeUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(normalizeUrl('http://b.example/')).toBe('http://b.example/');
  });
});

describe('isSafeExternalHttpUrl', () => {
  it('accepts only http/https absolute URLs', () => {
    expect(isSafeExternalHttpUrl('https://x.y/')).toBe(true);
    expect(isSafeExternalHttpUrl('relative')).toBe(false);
    expect(isSafeExternalHttpUrl('')).toBe(false);
  });
});
