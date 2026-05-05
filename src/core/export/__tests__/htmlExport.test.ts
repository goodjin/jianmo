import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeHtml,
  generateToc,
  buildHtmlDocument,
  markdownToHtml,
  renderMarkdownMath,
  exportToHtml,
  buildExportHtmlString,
  type HtmlExportOptions,
} from '../htmlExport';

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
  it('returns empty string for markdown without headings or diagrams', () => {
    expect(generateToc('Hello\nWorld')).toBe('');
  });

  it('M42: includes diagram anchors when headings absent', () => {
    const md = ['```mermaid', '%% alt: Flow', 'graph TD;A-->B', '```'].join('\n');
    const toc = generateToc(md);
    expect(toc).toContain('href="#markly-diagram-1"');
    expect(toc).toContain('toc-diagram');
    expect(toc).toContain('Flow');
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

  it('adds print-friendly body class when htmlTheme is print-friendly', () => {
    const html = buildHtmlDocument('<p>x</p>', '', { ...defaultOpts, htmlTheme: 'print-friendly' });
    expect(html).toContain('class="markly-export-print-friendly"');
    expect(html).toContain('body.markly-export-print-friendly');
  });

  it('M84: fenced code CSS wraps long lines and print allows pre inside page breaks', () => {
    const html = buildHtmlDocument('<pre><code>x</code></pre>', '', defaultOpts);
    expect(html).toContain('tab-size: 4');
    expect(html).toContain('overflow-wrap: anywhere');
    const printIdx = html.indexOf('@media print');
    expect(printIdx).toBeGreaterThan(-1);
    const printBlock = html.slice(printIdx, printIdx + 1200).replace(/\s+/g, ' ');
    expect(printBlock).toMatch(/pre \{[^}]*page-break-inside: auto/);
    expect(printBlock).toMatch(/blockquote \{[^}]*page-break-inside: avoid/);
  });

  it('M84: print-friendly theme repeats wrap hints on pre', () => {
    const html = buildHtmlDocument('', '', { ...defaultOpts, htmlTheme: 'print-friendly' });
    expect(html).toContain('body.markly-export-print-friendly pre');
    expect(html).toMatch(/body\.markly-export-print-friendly pre[\s\S]*?tab-size: 4/);
  });

  it('M32: print CSS requests repeating table header group semantics', () => {
    const html = buildHtmlDocument('<p>x</p>', '', defaultOpts);
    const printIdx = html.indexOf('@media print');
    expect(printIdx).toBeGreaterThan(-1);
    const printBlock = html.slice(printIdx, printIdx + 1800);
    expect(printBlock).toContain('thead');
    expect(printBlock).toContain('table-header-group');
  });

  it('M85: HTML document embeds mermaid CSS and bootstrap', () => {
    const html = buildHtmlDocument('<div class="mermaid markly-mermaid-await">x</div>', '', defaultOpts);
    expect(html).toContain('.markly-mermaid-await');
    expect(html).toContain('max-width: 100%');
    expect(html).toContain('mermaid.initialize');
    expect(html).toContain('DOMContentLoaded');
  });
});

describe('markdownToHtml export rendering', () => {
  it('M85: markdownToHtml turns mermaid fence into browser-render target div', async () => {
    const html = await markdownToHtml('```mermaid\nflowchart LR\n  A-->B\n```\n');
    expect(html).toContain('class="mermaid markly-mermaid-await"');
    expect(html).toContain('A-->B');
  });

  it('renders GFM table, fenced code, task list and relative image', async () => {
    const markdown = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '- [x] done',
      '',
      '![Alt](assets/a.png)',
    ].join('\n');

    const html = await markdownToHtml(markdown);

    expect(html).toContain('<table>');
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<img src="assets/a.png" alt="Alt">');
  });

  it('M31: GFM table cell may contain inline math (KaTeX) after markdownToHtml', async () => {
    const md = ['| 量 | 表达式 |', '| --- | --- |', '| 质能 | $E=mc^2$ |'].join('\n');
    const html = await markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('class="katex"');
    expect(html).toContain('E=mc');
  });

  it('M29：长管道表导出含 thead/tbody 且行数可观', async () => {
    const rows = ['| H1 | H2 |', '| -- | -- |'];
    for (let i = 0; i < 25; i++) {
      rows.push(`| c${i}1 | c${i}2 |`);
    }
    const html = await markdownToHtml(rows.join('\n'));
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    const trCount = (html.match(/<tr\b/g) ?? []).length;
    expect(trCount).toBeGreaterThanOrEqual(26);
    expect(html).toContain('c241');
    expect(html).toContain('<th>H1</th>');
  });

  it('renders inline and block math with KaTeX output', async () => {
    const html = await markdownToHtml('Inline $E=mc^2$\n\n$$\\frac{a}{b}$$');

    expect(html).toContain('class="katex"');
    expect(html).toContain('E=mc');
    expect(html).toContain('mfrac');
    expect(html).not.toContain('$E=mc^2$');
  });

  it('keeps invalid math readable instead of throwing', () => {
    const markdown = renderMarkdownMath('$\\badcommand{x}$');

    expect(markdown).toContain('class="katex"');
    expect(markdown).toContain('\\badcommand');
  });

  it('does not render dollar syntax inside fenced code blocks', async () => {
    const html = await markdownToHtml('```txt\n$E=mc^2$\n```\n\nOutside $x+1$');

    expect(html).toContain('<code class="language-txt">$E=mc^2$');
    expect(html).toContain('class="katex"');
  });

  it('M82: copyLocalImages bundles file and rewrites img src in exported HTML', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-htmlout-'));
    const docDir = path.join(root, 'doc');
    fs.mkdirSync(docDir, { recursive: true });
    const imgDir = path.join(docDir, 'img');
    fs.mkdirSync(imgDir, { recursive: true });
    fs.writeFileSync(path.join(imgDir, 'x.png'), 'fake');
    const outHtml = path.join(root, 'published', 'page.html');
    fs.mkdirSync(path.dirname(outHtml), { recursive: true });

    await exportToHtml('![x](./img/x.png)\n', outHtml, {
      includeToc: false,
      title: 't',
      copyLocalImages: true,
      documentBaseDir: docDir,
      assetsSubdirectory: 'html-assets',
    });

    const written = fs.readFileSync(outHtml, 'utf-8');
    expect(written).toMatch(/src="\.\/html-assets\/img\/x\.png"/);
    expect(fs.existsSync(path.join(root, 'published', 'html-assets', 'img', 'x.png'))).toBe(true);
  });

  it('M88: buildExportHtmlString matches export file when copyLocalImages is off', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-htmlout-'));
    const outHtml = path.join(root, 'page.html');
    const md = '# Hello\n\nParagraph.';
    await exportToHtml(md, outHtml, { includeToc: true, title: 't' });
    const written = fs.readFileSync(outHtml, 'utf-8');
    const built = await buildExportHtmlString(md, { includeToc: true, title: 't' });
    expect(built).toBe(written);
  });
});
