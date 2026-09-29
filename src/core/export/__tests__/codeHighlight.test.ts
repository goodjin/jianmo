import { describe, it, expect } from 'vitest';
import {
  highlightFencedCodeInHtml,
  createShikiTokenizer,
} from '../codeHighlight';

describe('highlightFencedCodeInHtml', () => {
  it('colors tokens for a known fence language and keeps the original tags', async () => {
    const html = '<pre><code class="language-ts">const x = 1;\n</code></pre>';
    const out = await highlightFencedCodeInHtml(html, 'light');

    // 外层标签逐字保留（mermaid 转换与下游解析依赖该形状）
    expect(out).toContain('<pre><code class="language-ts">');
    expect(out).toContain('</code></pre>');
    // 内层换成了着色 token
    expect(out).toMatch(/<span style="color:/);
    expect(out).toContain('const');
    expect(out).not.toBe(html);
  });

  it('leaves unknown fence languages untouched (素色代码块)', async () => {
    const html = '<pre><code class="language-txt">$E=mc^2$\n</code></pre>';
    const out = await highlightFencedCodeInHtml(html, 'light');
    expect(out).toBe(html);
  });

  it('never touches mermaid fences (留给图表管线转换)', async () => {
    const html = '<pre><code class="language-mermaid">flowchart LR\n  A--&gt;B\n</code></pre>';
    const out = await highlightFencedCodeInHtml(html, 'light');
    expect(out).toBe(html);
  });

  it('resolves common aliases (js/ts/py/sh/yml)', async () => {
    const html = '<pre><code class="language-js">const x = 1;\n</code></pre>';
    const out = await highlightFencedCodeInHtml(html, 'light');
    expect(out).toMatch(/<span style="color:/);
  });

  it('uses different palettes for light and dark themes', async () => {
    const html = '<pre><code class="language-js">const x = 1;\n</code></pre>';
    const light = await highlightFencedCodeInHtml(html, 'light');
    const dark = await highlightFencedCodeInHtml(html, 'dark');
    expect(light).not.toBe(dark);
  });

  it('decodes marked entities before tokenizing (代码里的 < > 不丢)', async () => {
    const html = '<pre><code class="language-js">if (a &lt; b) { return a; }\n</code></pre>';
    const out = await highlightFencedCodeInHtml(html, 'light');
    // 还原后交给 shiki 重新转义：比较符仍以实体存在，且不会被当成标签吃掉
    expect(out).toMatch(/&lt;|&#x3C;/);
    expect(out).not.toMatch(/a < b/);
    expect(out).toContain('return');
  });

  it('returns input unchanged when there is no fenced code', async () => {
    const html = '<p>hello</p>';
    expect(await highlightFencedCodeInHtml(html, 'light')).toBe(html);
  });

  it('highlights each block in a multi-block document independently', async () => {
    const html = [
      '<pre><code class="language-js">const a = 1;\n</code></pre>',
      '<p>mid</p>',
      '<pre><code class="language-python">def f():\n    pass\n</code></pre>',
    ].join('\n');
    const out = await highlightFencedCodeInHtml(html, 'light');
    expect(out).toContain('<pre><code class="language-js">');
    expect(out).toContain('<pre><code class="language-python">');
    expect(out).toContain('<p>mid</p>');
    expect((out.match(/<span style="color:/g) ?? []).length).toBeGreaterThan(2);
  });
});

describe('createShikiTokenizer', () => {
  it('returns null for unsupported languages and mermaid, colored spans otherwise', async () => {
    const tokenize = await createShikiTokenizer();
    expect(await tokenize('x', 'no-such-lang', 'light')).toBeNull();
    expect(await tokenize('graph TD', 'mermaid', 'light')).toBeNull();
    const out = await tokenize('const x = 1;', 'javascript', 'dark');
    expect(out).toMatch(/<span style="color:/);
    expect(out).toContain('const');
  });
});
