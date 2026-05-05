import { describe, expect, it } from 'vitest';
import { markdownToClipboardHtml } from '../richClipboard';

describe('richClipboard (M87)', () => {
  it('converts markdown headings and emphasis to HTML in clipboard fragment', () => {
    const html = markdownToClipboardHtml('# Title\n\n**bold**');
    expect(html).toContain('data-markly-rich-copy="1"');
    expect(html).toMatch(/<h1[^>]*>\s*Title\s*<\/h1>/i);
    expect(html).toMatch(/<strong>bold<\/strong>|<b>bold<\/b>/i);
  });

  it('includes charset hint and renders GFM-style pipe table', () => {
    const html = markdownToClipboardHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('charset');
    expect(html.toLowerCase()).toContain('<table');
  });
});
