import * as fs from 'fs';
import { marked } from 'marked';

export interface HtmlExportOptions {
  includeToc?: boolean;
  title?: string;
  inlineCss?: boolean;
  darkMode?: boolean;
}

const defaultOptions: HtmlExportOptions = {
  includeToc: true,
  title: '导出文档',
  inlineCss: true,
  darkMode: false,
};

/** HTML 转义，防止 XSS */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export async function exportToHtml(
  markdownContent: string,
  outputPath: string,
  options: HtmlExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };

  // 生成 TOC
  let tocHtml = '';
  if (opts.includeToc) {
    tocHtml = generateToc(markdownContent);
  }

  // 转换 Markdown 为 HTML
  const htmlContent = await markdownToHtml(markdownContent);

  // 构建完整 HTML
  const fullHtml = buildHtmlDocument(htmlContent, tocHtml, opts);

  // 写入文件
  fs.writeFileSync(outputPath, fullHtml, 'utf-8');
}

export function generateToc(markdown: string): string {
  const headings: { level: number; text: string; anchor: string }[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ level, text, anchor });
    }
  }

  if (headings.length === 0) return '';

  let tocHtml = '<nav class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    // 使用 escapeHtml 防止 XSS
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${h.anchor}">${escapeHtml(h.text)}</a></li>`;
  }
  tocHtml += '</ul></nav>';

  return tocHtml;
}

async function markdownToHtml(markdown: string): Promise<string> {
  // 使用 marked 转换 Markdown，支持 GFM
  const html = await marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  // 添加锚点到标题（修复：处理带属性的标题）
  return String(html).replace(/<h([1-6])([^>]*)>(.+?)<\/h[1-6]>/g, (match, level, attrs, text) => {
    // 如果已经有 id 属性，则保留
    if (/id=["']/.test(attrs)) {
      return match;
    }
    const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    // 使用 escapeHtml 防止 XSS
    return `<h${level} id="${anchor}"${attrs}>${escapeHtml(text)}</h${level}>`;
  });
}

export function buildHtmlDocument(content: string, tocHtml: string, opts: HtmlExportOptions): string {
  const { darkMode } = opts;
  const bgColor = darkMode ? '#0d1117' : '#ffffff';
  const textColor = darkMode ? '#c9d1d9' : '#24292e';
  const codeBg = darkMode ? '#161b22' : '#f6f8fa';
  const borderColor = darkMode ? '#30363d' : '#d0d7de';

  // 当 darkMode: false 时，添加 prefers-color-scheme: light 强制使用浅色
  // 阻止系统深色偏好影响
  const systemPreferenceMedia = darkMode
    ? `@media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #0d1117;
        --text-color: #c9d1d9;
        --code-bg: #161b22;
        --border-color: #30363d;
        --link-color: #58a6ff;
        --link-hover: #79b8ff;
      }
    }`
    : `@media (prefers-color-scheme: light) {
      :root {
        --bg-color: #ffffff;
        --text-color: #24292e;
        --code-bg: #f6f8fa;
        --border-color: #d0d7de;
        --link-color: #0969da;
        --link-hover: #0550ae;
      }
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #ffffff !important;
        --text-color: #24292e !important;
        --code-bg: #f6f8fa !important;
        --border-color: #d0d7de !important;
        --link-color: #0969da !important;
        --link-hover: #0550ae !important;
      }
    }`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title || '导出文档')}</title>
  <style>
    :root {
      --bg-color: ${bgColor};
      --text-color: ${textColor};
      --code-bg: ${codeBg};
      --border-color: ${borderColor};
      --link-color: #0969da;
      --link-hover: #0550ae;
    }

    ${systemPreferenceMedia}

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* TOC 样式 */
    .toc {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 40px;
    }

    .toc h2 {
      font-size: 1.5em;
      margin-top: 0;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border-color);
    }

    .toc ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc li {
      margin: 6px 0;
    }

    .toc a {
      color: var(--link-color);
      text-decoration: none;
    }

    .toc a:hover {
      color: var(--link-hover);
      text-decoration: underline;
    }

    /* 标题样式 */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 {
      font-size: 2em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--border-color);
    }

    h2 {
      font-size: 1.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--border-color);
    }

    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; }

    /* 段落和列表 */
    p {
      margin: 0 0 16px 0;
    }

    ul, ol {
      padding-left: 2em;
      margin-bottom: 16px;
    }

    li {
      margin: 4px 0;
    }

    /* 代码 */
    code {
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
    }

    pre {
      background-color: var(--code-bg);
      padding: 16px;
      overflow: auto;
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
    }

    pre code {
      background: transparent;
      padding: 0;
      font-size: 14px;
    }

    /* 引用 */
    blockquote {
      margin: 0 0 16px 0;
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid var(--border-color);
    }

    @media (prefers-color-scheme: dark) {
      blockquote {
        color: #8b949e;
      }
    }

    /* 表格 */
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }

    table th, table td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
    }

    table th {
      background-color: var(--code-bg);
      font-weight: 600;
    }

    table tr:nth-child(even) {
      background-color: var(--code-bg);
    }

    /* 链接 */
    a {
      color: var(--link-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
      color: var(--link-hover);
    }

    /* 图片 */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    /* 分割线 */
    hr {
      height: 2px;
      background-color: var(--border-color);
      border: none;
      margin: 24px 0;
    }

    /* 任务列表 */
    .task-list-item {
      list-style-type: none;
      margin-left: -1.5em;
    }

    .task-list-item input {
      margin-right: 0.5em;
    }

    /* 脚注 */
    .footnote {
      font-size: 0.9em;
      color: #6a737d;
      border-top: 1px solid var(--border-color);
      margin-top: 40px;
      padding-top: 20px;
    }

    @media (prefers-color-scheme: dark) {
      .footnote {
        color: #8b949e;
      }
    }

    /* 打印样式 */
    @media print {
      body {
        max-width: 100%;
        padding: 0;
      }

      .toc {
        page-break-after: always;
      }

      pre, blockquote {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${tocHtml}
  <div class="content">
    ${content}
  </div>
</body>
</html>`;
}
