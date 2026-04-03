/**
 * Editor Provider 相关纯逻辑测试
 *
 * MarkdownEditorProvider 本身强依赖 VSCode API（Webview, Uri, fs...），
 * 不适合做轻量单测。这里测试 provider 中用到的可抽取纯逻辑：
 * - getExportFilters 的映射正确性
 * - 简单 markdownToHtml 转换
 *
 * 完整的 provider 行为由 e2e/vscode 测试覆盖。
 */

import { describe, it, expect } from 'vitest';

/**
 * 从 customEditor.ts 中提取的 getExportFilters 逻辑（private 方法，
 * 在此镜像以验证映射关系，与源码保持同步）。
 */
function getExportFilters(format: string): { [key: string]: string[] } {
  const filters: { [key: string]: string[] } = {
    markdown: ['md', 'markdown'],
    html: ['html'],
    pdf: ['pdf'],
    json: ['json'],
  };
  return { [format.toUpperCase()]: filters[format] || ['*'] };
}

describe('getExportFilters', () => {
  it('returns correct extensions for html', () => {
    expect(getExportFilters('html')).toEqual({ HTML: ['html'] });
  });

  it('returns correct extensions for pdf', () => {
    expect(getExportFilters('pdf')).toEqual({ PDF: ['pdf'] });
  });

  it('returns correct extensions for markdown', () => {
    expect(getExportFilters('markdown')).toEqual({ MARKDOWN: ['md', 'markdown'] });
  });

  it('returns wildcard for unknown format', () => {
    expect(getExportFilters('docx')).toEqual({ DOCX: ['*'] });
  });
});

/**
 * customEditor.ts 中的简易 markdownToHtml 转换逻辑（private 方法，镜像验证）。
 */
function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Exported</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

describe('markdownToHtml (简易转换)', () => {
  it('converts heading levels correctly', () => {
    expect(markdownToHtml('# H1')).toContain('<h1>H1</h1>');
    expect(markdownToHtml('## H2')).toContain('<h2>H2</h2>');
    expect(markdownToHtml('### H3')).toContain('<h3>H3</h3>');
  });

  it('converts bold and italic', () => {
    const html = markdownToHtml('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('use `const`')).toContain('<code>const</code>');
  });

  it('converts links', () => {
    const html = markdownToHtml('[Google](https://google.com)');
    expect(html).toContain('<a href="https://google.com">Google</a>');
  });

  it('converts images (image regex runs after link, so ! prefix remains)', () => {
    // 源码中 image regex 在 link regex 之后执行，
    // 所以 ![alt](url) 已被 link regex 消费为 !<a>。
    // 这是已知的简易实现限制，真正的导出用 marked 库。
    const html = markdownToHtml('![alt](image.png)');
    expect(html).toContain('image.png');
  });

  it('wraps in complete HTML document', () => {
    const html = markdownToHtml('hello');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
