import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';
import type { PdfConfig, PdfExportTemplateId } from '@types';
import { readKatexCss, renderMarkdownMath } from './htmlExport';
import {
  buildMermaidExportBootstrapScript,
  getMermaidExportDocumentCss,
  transformMermaidFencesForExport,
  type ExportMermaidTheme,
} from './mermaidExport';

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
  /** M81：版式模板（与 `PdfConfig.template` 对齐） */
  template?: PdfExportTemplateId;
  /** 用于解析导出时的相对图片路径（通常传入 markdown 文件所在目录的 file:// URL）。 */
  baseHref?: string;
}

const defaultOptions: PdfExportOptions = {
  format: 'A4',
  margin: {
    top: '25mm',
    right: '20mm',
    bottom: '25mm',
    left: '20mm',
  },
  displayHeaderFooter: true,
  includeToc: true,
};

/** 将工作区 `markly.export.pdf.*`（mm）转为 Puppeteer `page.pdf` 选项。 */
export function pdfExportOptionsFromPdfConfig(pdf: PdfConfig, baseHref?: string): PdfExportOptions {
  const m = pdf.margin;
  return {
    format: pdf.format,
    margin: {
      top: `${Number(m.top)}mm`,
      right: `${Number(m.right)}mm`,
      bottom: `${Number(m.bottom)}mm`,
      left: `${Number(m.left)}mm`,
    },
    includeToc: pdf.includeToc,
    displayHeaderFooter: pdf.displayHeaderFooter,
    template: pdf.template ?? 'default',
    baseHref,
  };
}

/** HTML 转义，防止 XSS */
export function escapeHtmlPdf(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export async function exportToPdf(
  markdownContent: string,
  outputPath: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };

  // 注意：ExTester/VS Code UI 测试环境并不一定会为扩展安装 node_modules。
  // 若 puppeteer 在顶层静态导入，会导致扩展激活失败（CustomEditor 不会渲染）。
  // 因此这里改为按需动态加载：仅在真正导出 PDF 时才 require。
  const puppeteerModule = await import('puppeteer');
  const puppeteer = (puppeteerModule as any).default ?? puppeteerModule;

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
      tocHtml = generateTocPdf(markdownContent);
    }

    // 转换 Markdown 为 HTML
    const htmlContent = await markdownToPdfHtml(markdownContent);

    // 构建完整 HTML
    const tpl: PdfExportTemplateId = opts.template ?? 'default';
    const fullHtml = buildPdfHtmlDocument(htmlContent, tocHtml, { baseHref: opts.baseHref, template: tpl });

    // 加载页面（内联 Mermaid；等待图表渲染后再打 PDF）
    await page.setContent(fullHtml, { waitUntil: 'load' });
    try {
      await page.waitForFunction(
        () => {
          const pending = document.querySelectorAll('.markly-mermaid-await');
          if (pending.length === 0) return true;
          return Array.from(pending).every((el) => el.querySelector('svg'));
        },
        { timeout: 20_000 }
      );
    } catch {
      /* 无 Mermaid 或渲染失败时仍导出 */
    }

    // 生成 PDF
    await page.pdf({
      path: outputPath,
      format: opts.format,
      margin: opts.margin,
      displayHeaderFooter: opts.displayHeaderFooter,
      headerTemplate: opts.headerTemplate || getPdfHeaderTemplate(tpl),
      footerTemplate: opts.footerTemplate || getDefaultFooterTemplate(),
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

export function generateTocPdf(markdown: string): string {
  const headings: { level: number; text: string; anchor: string }[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const anchor = generateAnchor(text);  // 使用统一函数
      headings.push({ level, text, anchor });
    }
  }

  if (headings.length === 0) return '';

  let tocHtml = '<div class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${h.anchor}">${escapeHtmlPdf(h.text)}</a></li>`;
  }
  tocHtml += '</ul></div><div class="page-break"></div>';

  return tocHtml;
}

export async function markdownToPdfHtml(markdown: string): Promise<string> {
  // 使用 marked.use() 配置选项（已废弃 gfm/breaks 参数）
  marked.use({
    gfm: true,
    breaks: true,
  });

  // 使用 marked 转换 Markdown
  const html = await marked.parse(renderMarkdownMath(markdown));

  // 添加锚点到标题（使用统一函数生成锚点）
  const withAnchors = html.replace(/<h([1-6])>(.+?)<\/h[1-6]>/g, (match, level, text) => {
    const anchor = generateAnchor(text);
    return `<h${level} id="${anchor}">${escapeHtmlPdf(text)}</h${level}>`;
  });

  return transformMermaidFencesForExport(withAnchors);
}

/** 统一的锚点生成函数 */
export function generateAnchor(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

/** 学术风：衬线、偏印刷色面（与 default 区分明显） */
export function getPdfTemplateExtraCss(template: PdfExportTemplateId): string {
  if (template === 'default') return '';
  return `
    body.markly-pdf--academic {
      font-family: Georgia, Cambria, 'Times New Roman', Times, serif;
      color: #1a1a1a;
      font-size: 15px;
      line-height: 1.68;
    }
    body.markly-pdf--academic .toc {
      padding: 48px 56px;
    }
    body.markly-pdf--academic .toc h2 {
      font-size: 22px;
      letter-spacing: 0.04em;
      border-bottom: 3px double #222;
      padding-bottom: 12px;
    }
    body.markly-pdf--academic .content {
      padding: 48px 56px;
    }
    body.markly-pdf--academic h1 {
      font-size: 1.85em;
      border-bottom-color: #c9c2b8;
    }
    body.markly-pdf--academic h2 {
      border-bottom-color: #d8d2c9;
    }
    body.markly-pdf--academic code {
      background-color: #f4f1ea;
      border: 1px solid #e5dfd4;
    }
    body.markly-pdf--academic pre {
      background-color: #faf7f0;
      border: 1px solid #e8e4dc;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
    }
    body.markly-pdf--academic blockquote {
      border-left-color: #8b7355;
      color: #3d3d3d;
    }
    body.markly-pdf--academic table th {
      background-color: #ede8df;
    }
  `;
}

export function buildPdfHtmlDocument(
  content: string,
  tocHtml: string,
  opts?: { baseHref?: string; template?: PdfExportTemplateId; mermaidTheme?: ExportMermaidTheme }
): string {
  const baseTag = opts?.baseHref ? `<base href="${escapeHtmlPdf(String(opts.baseHref))}">` : '';
  const template: PdfExportTemplateId = opts?.template ?? 'default';
  const bodyClass = `markly-pdf markly-pdf--${template}`;
  const extraCss = getPdfTemplateExtraCss(template);
  const mermaidTheme: ExportMermaidTheme = opts?.mermaidTheme ?? 'default';
  const mermaidBoot = buildMermaidExportBootstrapScript(mermaidTheme);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>导出文档</title>
  ${baseTag}
  <style>
    ${readKatexCss()}
    ${getMermaidExportDocumentCss()}
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
      overflow-wrap: break-word;
      word-break: break-word;
    }

    pre {
      background-color: #f6f8fa;
      padding: 16px;
      overflow-x: auto;
      overflow-y: hidden;
      border-radius: 6px;
      margin-bottom: 16px;
      /* M84：长行换行 + 极长 token 可断行；长代码块允许跨页 */
      page-break-inside: auto;
      break-inside: auto;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    pre code {
      background: transparent;
      padding: 0;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    /* 表格：表头重复、行尽量不拆开 */
    thead {
      display: table-header-group;
    }

    tbody {
      display: table-row-group;
    }

    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* 块级数学尽量不跨页断开 */
    .katex-display {
      page-break-inside: avoid;
      break-inside: avoid;
      overflow-x: auto;
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
    ${extraCss}
  </style>
</head>
<body class="${bodyClass}">
  ${tocHtml}
  <div class="content">
    ${content}
  </div>
${mermaidBoot}
</body>
</html>`;
}

export function getPdfHeaderTemplate(template: PdfExportTemplateId): string {
  const label = template === 'academic' ? 'Markly · 学术' : 'Markly Export';
  return `<div style="font-size: 9px; width: 100%; padding: 10px 40px; color: #666;">
    <span>${escapeHtmlPdf(label)}</span>
  </div>`;
}

function getDefaultFooterTemplate(): string {
  return `<div style="font-size: 9px; width: 100%; padding: 10px 40px; color: #666; display: flex; justify-content: space-between;">
    <span></span>
    <span class="pageNumber"></span>
  </div>`;
}
