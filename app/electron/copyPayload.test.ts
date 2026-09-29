import { describe, expect, it } from 'vitest';
import { buildExportHtmlString, markdownToHtml } from '../../src/core/export/htmlExport';
import {
  buildClipboardWrite,
  extractPreviewContentHtml,
  normalizeCopyPayload,
  wrapClipboardHtml,
} from './copyPayload';

describe('extractPreviewContentHtml', () => {
  it('抽出 .content 内层，不含 toc / script', () => {
    const full = [
      '<html><body>',
      '<nav class="toc"><h2>目录</h2></nav>',
      '<div class="content">',
      '<h1 id="hi">标题</h1><p>正文段落。</p>',
      '</div>',
      '<script>window.__x=1</script>',
      '</body></html>',
    ].join('\n');
    const inner = extractPreviewContentHtml(full);
    expect(inner).toContain('<h1 id="hi">标题</h1>');
    expect(inner).toContain('<p>正文段落。</p>');
    expect(inner).not.toContain('目录');
    expect(inner).not.toContain('<script>');
    expect(inner).not.toContain('class="content"');
  });

  it('正文含嵌套 div（mermaid）时抽完整层，不截在内层 </div>', () => {
    const full = [
      '<div class="content">',
      '<p>前</p>',
      '<div class="mermaid">graph TD; A-->B;</div>',
      '<p>后</p>',
      '</div>',
      '<script></script>',
    ].join('');
    const inner = extractPreviewContentHtml(full);
    expect(inner).toContain('<p>前</p>');
    expect(inner).toContain('<div class="mermaid">graph TD; A-->B;</div>');
    expect(inner).toContain('<p>后</p>');
  });

  it('没有 .content 返回空串', () => {
    expect(extractPreviewContentHtml('<html><body><p>x</p></body></html>')).toBe('');
    expect(extractPreviewContentHtml('')).toBe('');
  });

  it('真实导出 HTML：抽出正文、不含目录与脚本', async () => {
    const full = await buildExportHtmlString('# Hello\n\nworld', { includeToc: true, title: 'T' });
    const inner = extractPreviewContentHtml(full);
    expect(inner).toContain('Hello');
    expect(inner).toContain('world');
    expect(inner).not.toContain('class="toc"');
    expect(inner).not.toContain('<script>');
    const payload = buildClipboardWrite({ markdown: '# Hello\n\nworld', contentHtml: inner });
    expect(payload.html).toContain('<meta charset="utf-8">');
    expect(payload.html).toContain('Hello');
  });
});

describe('buildClipboardWrite', () => {
  it('text 是 Markdown 源；html 包一层 charset 文档', () => {
    const payload = buildClipboardWrite({
      markdown: '# 标题\n\n正文',
      contentHtml: '<h1>标题</h1><p>正文</p>',
    });
    expect(payload.text).toBe('# 标题\n\n正文');
    expect(payload.html).toContain('<meta charset="utf-8">');
    expect(payload.html).toContain('<h1>标题</h1><p>正文</p>');
    expect(payload.html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('contentHtml 为空时 html 留空，让主进程走 markdownToHtml 兜底', () => {
    const payload = buildClipboardWrite({ markdown: '# A', contentHtml: '   ' });
    expect(payload.text).toBe('# A');
    expect(payload.html).toBe('');
  });
});

describe('wrapClipboardHtml / normalizeCopyPayload', () => {
  it('wrap 产出可粘贴的最小 HTML 文档', () => {
    expect(wrapClipboardHtml('<p>你好</p>')).toBe(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>你好</p></body></html>'
    );
  });

  it('renderer 已带 html 则原样采用，不二次包裹', () => {
    const wrapped = wrapClipboardHtml('<p>x</p>');
    const out = normalizeCopyPayload({ text: '# x', html: wrapped }, 'FALLBACK_MD', '<p>fb</p>');
    expect(out.text).toBe('# x');
    expect(out.html).toBe(wrapped);
  });

  it('缺 html 时用 fallbackContentHtml 包裹', () => {
    const out = normalizeCopyPayload({ text: '# x' }, 'FALLBACK_MD', '<h1>x</h1>');
    expect(out.text).toBe('# x');
    expect(out.html).toBe(wrapClipboardHtml('<h1>x</h1>'));
  });

  it('renderer 尚未 INIT（text 为空串）时 text 走 fallback，避免复制空文档', () => {
    const out = normalizeCopyPayload({ text: '', html: '' }, '# 真实内容', '<p>真实内容</p>');
    expect(out.text).toBe('# 真实内容');
    expect(out.html).toBe(wrapClipboardHtml('<p>真实内容</p>'));
  });

  it('payload 缺失时 text/html 都走 fallback', () => {
    const out = normalizeCopyPayload(undefined, '# fb', '<p>fb</p>');
    expect(out.text).toBe('# fb');
    expect(out.html).toBe(wrapClipboardHtml('<p>fb</p>'));
  });

  it('markdownToHtml 兜底产物含标题与加粗，可直接作为 html 写入', async () => {
    const md = '# 标题\n\n**加粗** 正文';
    const html = await markdownToHtml(md);
    const out = normalizeCopyPayload(undefined, md, html);
    expect(out.text).toBe(md);
    expect(out.html).toContain('<h1');
    expect(out.html).toContain('标题');
    expect(out.html).toContain('<strong>');
    expect(out.html).toContain('正文');
  });
});
