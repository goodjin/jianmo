import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import puppeteer from 'puppeteer';
import { marked } from 'marked';

export interface PdfExportOptions {
  format?: 'A4' | 'A3' | 'Letter' | 'Legal';
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  includeToc?: boolean;
}

const defaultOptions: PdfExportOptions = {
  format: 'A4',
  margin: {
    top: '80px',
    right: '40px',
    bottom: '80px',
    left: '40px',
  },
  displayHeaderFooter: true,
  includeToc: true,
};

export async function exportToPdf(
  markdownContent: string,
  outputPath: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };

  // 启动 puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 生成 TOC
    let tocHtml = '';
    if (opts.includeToc) {
      tocHtml = generateToc(markdownContent);
    }

    // 转换 Markdown 为 HTML
    const htmlContent = await markdownToHtml(markdownContent);

    // 构建完整 HTML
    const fullHtml = buildHtmlDocument(htmlContent, tocHtml);

    // 加载页面
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // 生成 PDF
    await page.pdf({
      path: outputPath,
      format: opts.format,
      margin: opts.margin,
      displayHeaderFooter: opts.displayHeaderFooter,
      headerTemplate: opts.headerTemplate || getDefaultHeaderTemplate(),
      footerTemplate: opts.footerTemplate || getDefaultFooterTemplate(),
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

function generateToc(markdown: string): string {
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

  let tocHtml = '<div class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${h.anchor}">${h.text}</a></li>`;
  }
  tocHtml += '</ul></div><div class="page-break"></div>';

  return tocHtml;
}

async function markdownToHtml(markdown: string): Promise<string> {
  // 使用 marked 转换 Markdown
  const html = await marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  // 添加锚点到标题
  let headingCount = 0;
  return html.replace(/<h([1-6])>(.+?)<\/h[1-6]>/g, (match, level, text) => {
    headingCount++;
    const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    return `<h${level} id="${anchor}">${text}</h${level}>`;
  });
}

function buildHtmlDocument(content: string, tocHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>导出文档</title>
  <style>
    @page {
      margin: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }

    /* TOC 样式 */
    .toc {
      page-break-after: always;
      padding: 40px;
    }

    .toc h2 {
      font-size: 24px;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }

    .toc ul {
      list-style: none;
      padding: 0;
    }

    .toc li {
      margin: 8px 0;
    }

    .toc a {
      color: #333;
      text-decoration: none;
    }

    .toc a:hover {
      text-decoration: underline;
    }

    /* 分页 */
    .page-break {
      page-break-after: always;
    }

    /* 内容样式 */
    .content {
      padding: 40px;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }

    p {
      margin: 0 0 16px 0;
    }

    code {
      background-color: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
    }

    pre {
      background-color: #f6f8fa;
      padding: 16px;
      overflow: auto;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    blockquote {
      margin: 0 0 16px 0;
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }

    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }

    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    ul, ol {
      margin-bottom: 16px;
      padding-left: 2em;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    .footnote {
      font-size: 0.9em;
      color: #666;
      border-top: 1px solid #ddd;
      margin-top: 40px;
      padding-top: 20px;
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

function getDefaultHeaderTemplate(): string {
  return `<div style="font-size: 9px; width: 100%; padding: 10px 40px; color: #666;">
    <span>简墨 Markdown 导出</span>
  </div>`;
}

function getDefaultFooterTemplate(): string {
  return `<div style="font-size: 9px; width: 100%; padding: 10px 40px; color: #666; display: flex; justify-content: space-between;">
    <span></span>
    <span class="pageNumber"></span>
  </div>`;
}
