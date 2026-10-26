import { describe, expect, it } from 'vitest';
import { buildPlainPreviewHtml } from './plainView';

describe('buildPlainPreviewHtml', () => {
  it('井号和脚本原样留下，不排成标题，也不执行', () => {
    const html = buildPlainPreviewHtml('# 不是标题\n\n<script>alert(1)</script>');
    expect(html).toContain('class="plain-text"');
    expect(html).toContain('# 不是标题');
    expect(html).not.toContain('<h1');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('去掉开头的 BOM', () => {
    expect(buildPlainPreviewHtml('\uFEFFhello')).toContain('>hello</pre>');
  });
});
