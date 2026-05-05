import { describe, it, expect } from 'vitest';
import type { PdfConfig } from '@types';
import {
  escapeHtmlPdf,
  generateAnchor,
  generateTocPdf,
  markdownToPdfHtml,
  buildPdfHtmlDocument,
  pdfExportOptionsFromPdfConfig,
  getPdfTemplateExtraCss,
  getPdfHeaderTemplate,
} from '../pdfExport';

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

describe('markdownToPdfHtml', () => {
  it('renders inline and block math with KaTeX output', async () => {
    const html = await markdownToPdfHtml('Inline $E=mc^2$\n\n$$\\frac{a}{b}$$');

    expect(html).toContain('class="katex"');
    expect(html).toContain('E=mc');
    expect(html).toContain('mfrac');
    expect(html).not.toContain('$E=mc^2$');
  });

  it('does not render dollar syntax inside fenced code blocks', async () => {
    const html = await markdownToPdfHtml('```txt\n$E=mc^2$\n```\n\nOutside $x+1$');

    expect(html).toContain('<code class="language-txt">$E=mc^2$');
    expect(html).toContain('class="katex"');
  });

  it('renders GFM table cells', async () => {
    const html = await markdownToPdfHtml('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td');
    expect(html).toContain('1');
  });
});

describe('buildPdfHtmlDocument', () => {
  it('injects <base> for resolving relative assets when baseHref provided', () => {
    const html = buildPdfHtmlDocument('<p>x</p>', '', { baseHref: 'file:///Users/me/project/' });
    expect(html).toContain('<base href="file:///Users/me/project/">');
  });

  it('embeds print-oriented rules for tables, code blocks and block math', () => {
    const html = buildPdfHtmlDocument('<p>x</p>', '');
    expect(html).toContain('table-header-group');
    expect(html).toContain('.katex-display');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('break-inside: auto');
    expect(html).toContain('white-space: pre-wrap');
  });

  it('M84: PDF pre/code include long-line wrap, tab-size and print color adjust', () => {
    const html = buildPdfHtmlDocument('<p>x</p>', '');
    expect(html).toContain('tab-size: 4');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('print-color-adjust: exact');
    expect(html).toMatch(/pre code \{[^}]*white-space: pre-wrap/s);
  });

  it('M85: PDF HTML embeds mermaid CSS and bootstrap', () => {
    const html = buildPdfHtmlDocument('<div class="mermaid markly-mermaid-await">x</div>', '');
    expect(html).toContain('.markly-mermaid-await');
    expect(html).toContain('mermaid.initialize');
    expect(html).toContain('DOMContentLoaded');
  });

  it('M85: markdownToPdfHtml turns mermaid fence into await div', async () => {
    const h = await markdownToPdfHtml('```mermaid\nflowchart TD\n  A-->B\n```');
    expect(h).toContain('markly-mermaid-await');
    expect(h).toContain('A-->B');
  });

  it('M81: academic template adds body class and serif override CSS', () => {
    const html = buildPdfHtmlDocument('<p>x</p>', '', { template: 'academic' });
    expect(html).toContain('class="markly-pdf markly-pdf--academic"');
    expect(html).toContain('body.markly-pdf--academic');
    expect(html).toContain('Georgia');
  });

  it('M81: default template body class without academic-only rules', () => {
    const html = buildPdfHtmlDocument('<p>x</p>', '', { template: 'default' });
    expect(html).toContain('markly-pdf--default');
    expect(getPdfTemplateExtraCss('default')).toBe('');
  });
});

describe('getPdfHeaderTemplate (M81)', () => {
  it('labels academic vs default', () => {
    expect(getPdfHeaderTemplate('academic')).toContain('学术');
    expect(getPdfHeaderTemplate('default')).toContain('Markly Export');
  });
});

describe('pdfExportOptionsFromPdfConfig', () => {
  it('maps mm margins and flags for Puppeteer', () => {
    const pdf: PdfConfig = {
      format: 'Letter',
      margin: { top: 10, right: 11, bottom: 12, left: 13 },
      includeToc: false,
      displayHeaderFooter: false,
    };
    const o = pdfExportOptionsFromPdfConfig(pdf, 'file:///tmp/doc/');
    expect(o.format).toBe('Letter');
    expect(o.margin).toEqual({
      top: '10mm',
      right: '11mm',
      bottom: '12mm',
      left: '13mm',
    });
    expect(o.includeToc).toBe(false);
    expect(o.displayHeaderFooter).toBe(false);
    expect(o.baseHref).toBe('file:///tmp/doc/');
    expect(o.template).toBe('default');
  });

  it('M81: forwards pdf.template when set', () => {
    const o = pdfExportOptionsFromPdfConfig(
      {
        format: 'A4',
        margin: { top: 25, right: 20, bottom: 25, left: 20 },
        includeToc: true,
        displayHeaderFooter: true,
        template: 'academic',
      },
      undefined
    );
    expect(o.template).toBe('academic');
  });
});
