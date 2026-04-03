import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHtml, generateToc, buildHtmlDocument, type HtmlExportOptions } from '../htmlExport';

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#039;');
  });

  it('escapes a full XSS payload', () => {
    const payload = '<script>alert("xss")</script>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes all occurrences, not just the first', () => {
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
  });

  it('handles mixed special characters', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
    );
  });
});

describe('generateToc', () => {
  it('returns empty string for markdown without headings', () => {
    expect(generateToc('Hello\nWorld')).toBe('');
  });

  it('generates TOC for single heading', () => {
    const toc = generateToc('# Title');
    expect(toc).toContain('<nav class="toc">');
    expect(toc).toContain('Title');
    expect(toc).toContain('href="#title"');
  });

  it('generates TOC for multiple heading levels', () => {
    const md = '# H1\n## H2\n### H3';
    const toc = generateToc(md);
    expect(toc).toContain('href="#h1"');
    expect(toc).toContain('href="#h2"');
    expect(toc).toContain('href="#h3"');
    expect(toc).toContain('margin-left: 0px');
    expect(toc).toContain('margin-left: 20px');
    expect(toc).toContain('margin-left: 40px');
  });

  it('escapes XSS payloads in heading text', () => {
    const md = '# <script>alert(1)</script>';
    const toc = generateToc(md);
    expect(toc).not.toContain('<script>');
    expect(toc).toContain('&lt;script&gt;');
  });

  it('generates correct anchors with special characters', () => {
    const md = '## Hello World!';
    const toc = generateToc(md);
    expect(toc).toContain('href="#hello-world"');
  });
});

describe('buildHtmlDocument', () => {
  const defaultOpts: HtmlExportOptions = {
    includeToc: false,
    title: '测试文档',
    inlineCss: true,
    darkMode: false,
  };

  it('wraps content in valid HTML', () => {
    const html = buildHtmlDocument('<p>Hello</p>', '', defaultOpts);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('</html>');
  });

  it('escapes title to prevent XSS', () => {
    const opts = { ...defaultOpts, title: '<script>alert("xss")</script>' };
    const html = buildHtmlDocument('', '', opts);
    expect(html).not.toMatch(/<title>.*<script>/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes TOC when provided', () => {
    const toc = '<nav class="toc"><h2>目录</h2></nav>';
    const html = buildHtmlDocument('<p>content</p>', toc, defaultOpts);
    expect(html).toContain(toc);
    expect(html).toContain('<p>content</p>');
  });

  it('applies dark mode CSS variables', () => {
    const html = buildHtmlDocument('', '', { ...defaultOpts, darkMode: true });
    expect(html).toContain('--bg-color: #0d1117');
    expect(html).toContain('--text-color: #c9d1d9');
  });

  it('applies light mode CSS variables', () => {
    const html = buildHtmlDocument('', '', { ...defaultOpts, darkMode: false });
    expect(html).toContain('--bg-color: #ffffff');
    expect(html).toContain('--text-color: #24292e');
  });

  it('defaults title to 导出文档 when title is undefined', () => {
    const html = buildHtmlDocument('', '', { ...defaultOpts, title: undefined });
    expect(html).toContain('<title>导出文档</title>');
  });
});
