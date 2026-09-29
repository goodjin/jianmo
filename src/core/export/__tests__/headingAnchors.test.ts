import { describe, it, expect } from 'vitest';
import {
  addHeadingAnchors,
  formatInlineMarkdown,
  generateToc,
  headingAnchor,
  headingSlug,
  markdownToHtml,
  stripCustomIdToken,
} from '../htmlExport';

describe('stripCustomIdToken（标题可见文本）', () => {
  it('剥掉尾部的 {#custom-id} 标记（含紧凑写法）', () => {
    expect(stripCustomIdToken('快速开始 {#quick}')).toBe('快速开始');
    expect(stripCustomIdToken('快速开始{#quick}')).toBe('快速开始');
  });

  it('只剥尾部：正文中间的同形标记是文案，保留', () => {
    expect(stripCustomIdToken('**加粗** {#bold} 正文')).toBe('**加粗** {#bold} 正文');
  });

  it('没有标记时原样返回', () => {
    expect(stripCustomIdToken('普通标题')).toBe('普通标题');
    expect(stripCustomIdToken('')).toBe('');
    expect(stripCustomIdToken('  {#only-anchor}  ')).toBe('');
  });

  it('行内代码里的标记不是尾部纯文本，不剥', () => {
    expect(stripCustomIdToken('结尾带代码 `code {#keep}`')).toBe('结尾带代码 `code {#keep}`');
  });
});

describe('headingAnchor / headingSlug', () => {
  it('prefers custom {#id} over slug', () => {
    expect(headingAnchor('快速开始 {#intro}', 1)).toBe('intro');
  });

  it('falls back to a stable index when nothing linkable remains', () => {
    expect(headingAnchor('!!!', 3)).toBe('markly-h-3');
  });

  it('matches webview outline slugs for CJK + latin mixed headings', () => {
    expect(headingSlug('标题 Title')).toBe('标题-title');
    expect(headingSlug('安装 & 配置')).toBe('安装-配置');
  });
});

describe('formatInlineMarkdown (目录标签)', () => {
  it('renders emphasis and code while escaping raw HTML', () => {
    expect(formatInlineMarkdown('**加粗** 与 `code`')).toBe('<strong>加粗</strong> 与 <code>code</code>');
    expect(formatInlineMarkdown('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(formatInlineMarkdown('')).toBe('');
  });

  it('keeps only the visible text of links and images', () => {
    expect(formatInlineMarkdown('见 [文档](https://a.b/c)')).toBe('见 文档');
    expect(formatInlineMarkdown('![图](./x.png)')).toBe('图');
    expect(formatInlineMarkdown('~~删除~~')).toBe('<del>删除</del>');
    expect(formatInlineMarkdown('*斜体*')).toBe('<em>斜体</em>');
  });
});

describe('addHeadingAnchors', () => {
  it('keeps inline formatting inside headings and only adds id', () => {
    const out = addHeadingAnchors('<h2>A <em>b</em> <code>c</code></h2>');
    expect(out).toBe('<h2 id="a-b-c">A <em>b</em> <code>c</code></h2>');
  });

  it('keeps ids that already exist', () => {
    expect(addHeadingAnchors('<h2 id="keep">x</h2>')).toBe('<h2 id="keep">x</h2>');
  });

  it('numbers fallback anchors by document order', () => {
    const out = addHeadingAnchors('<h1>!!!</h1><h2>!!!</h2>');
    expect(out).toContain('id="markly-h-1"');
    expect(out).toContain('id="markly-h-2"');
  });

  it('strips the trailing {#custom-id} token from the displayed text but keeps the id', () => {
    expect(addHeadingAnchors('<h2>快速开始 {#quick}</h2>')).toBe('<h2 id="quick">快速开始</h2>');
    // 行内标记在标记之前也照常剥
    expect(addHeadingAnchors('<h2><strong>加粗</strong> {#bold}</h2>')).toBe(
      '<h2 id="bold"><strong>加粗</strong></h2>'
    );
  });

  it('keeps a code span at the heading tail intact while slugging from its plain text', () => {
    // 尾部是 </code>，{#keep} 在行内代码里不是锚点语法 → 原样保留
    expect(addHeadingAnchors('<h2>结尾 <code>code {#keep}</code></h2>')).toBe(
      '<h2 id="keep">结尾 <code>code {#keep}</code></h2>'
    );
  });
});

describe('markdownToHtml 标题与目录一致性', () => {
  it('keeps emphasis/code rendered in headings instead of escaping them', async () => {
    const html = await markdownToHtml('# 说明 *强调* `代码`');
    expect(html).toContain('<em>强调</em>');
    expect(html).toContain('<code>代码</code>');
    expect(html).not.toContain('&lt;em&gt;');
  });

  it('TOC href and body heading id agree for CJK + inline markup', async () => {
    const md = '## **快速开始** {#quick}\n\n### 标题 Title\n';
    const toc = generateToc(md);
    const html = await markdownToHtml(md);

    expect(toc).toContain('href="#quick"');
    expect(html).toContain('<h2 id="quick">');
    expect(toc).toContain('href="#标题-title"');
    expect(html).toContain('<h3 id="标题-title">');
  });

  it('TOC labels render inline markup instead of raw markdown syntax', async () => {
    const toc = generateToc('# **加粗**标题');
    expect(toc).toContain('<strong>加粗</strong>标题');
    expect(toc).not.toContain('**');
  });

  it('custom {#id} syntax never leaks into rendered heading text or TOC labels', async () => {
    const md = '## 快速开始 {#quick}\n';
    const html = await markdownToHtml(md);
    const toc = generateToc(md);

    expect(html).toContain('<h2 id="quick">快速开始</h2>');
    expect(html).not.toContain('{#quick}');
    expect(toc).toContain('>快速开始</a>');
    expect(toc).not.toContain('{#quick}');
  });

  it('ignores "# comment" lines inside fenced code blocks', () => {
    const md = ['```sh', '# 只是注释', '```', '', '# 真标题'].join('\n');
    const toc = generateToc(md);
    expect(toc).toContain('真标题');
    expect(toc).not.toContain('只是注释');
    expect((toc.match(/href="/g) ?? []).length).toBe(1);
  });

  it('drops KaTeX MathML duplication from heading text when slugging', async () => {
    const html = await markdownToHtml('# 公式 $x$');
    // 标题内 KaTeX 会同时输出 MathML 与 HTML 两层，锚点只应算一次
    expect(html).toMatch(/<h1 id="[^"]*x[^"]*">/);
    expect(html).not.toContain('id="公式-xx"');
  });
});
