import { describe, it, expect } from 'vitest';
import { escapeHtmlPdf, generateAnchor, generateTocPdf } from '../pdfExport';

describe('escapeHtmlPdf', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtmlPdf('&')).toBe('&amp;');
    expect(escapeHtmlPdf('<')).toBe('&lt;');
    expect(escapeHtmlPdf('>')).toBe('&gt;');
    expect(escapeHtmlPdf('"')).toBe('&quot;');
    expect(escapeHtmlPdf("'")).toBe('&#039;');
  });

  it('escapes full XSS payload', () => {
    const escaped = escapeHtmlPdf('<img onerror="alert(1)" src=x>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toBe('&lt;img onerror=&quot;alert(1)&quot; src=x&gt;');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtmlPdf('正常文本 123')).toBe('正常文本 123');
  });

  it('handles empty string', () => {
    expect(escapeHtmlPdf('')).toBe('');
  });
});

describe('generateAnchor', () => {
  it('lowercases text', () => {
    expect(generateAnchor('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateAnchor('a b c')).toBe('a-b-c');
  });

  it('removes special characters', () => {
    expect(generateAnchor('Hello! World?')).toBe('hello-world');
  });

  it('handles multiple consecutive spaces', () => {
    expect(generateAnchor('a   b')).toBe('a-b');
  });

  it('handles empty string', () => {
    expect(generateAnchor('')).toBe('');
  });

  it('preserves hyphens', () => {
    expect(generateAnchor('my-heading')).toBe('my-heading');
  });

  it('handles CJK characters by removing them', () => {
    const anchor = generateAnchor('标题 Title');
    expect(anchor).toBe('-title');
  });
});

describe('generateTocPdf', () => {
  it('returns empty string when no headings', () => {
    expect(generateTocPdf('Just a paragraph')).toBe('');
  });

  it('generates TOC with heading text escaped', () => {
    const toc = generateTocPdf('# <script>xss</script>');
    expect(toc).not.toContain('<script>');
    expect(toc).toContain('&lt;script&gt;');
  });

  it('generates anchors using generateAnchor', () => {
    const toc = generateTocPdf('## Hello World');
    expect(toc).toContain('href="#hello-world"');
  });

  it('indents by heading level', () => {
    const toc = generateTocPdf('# L1\n## L2\n### L3');
    expect(toc).toContain('margin-left: 0px');
    expect(toc).toContain('margin-left: 20px');
    expect(toc).toContain('margin-left: 40px');
  });

  it('includes page break after TOC', () => {
    const toc = generateTocPdf('# Heading');
    expect(toc).toContain('class="page-break"');
  });
});
