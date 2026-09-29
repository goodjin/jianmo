import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';
import type { PdfConfig, PdfExportTemplateId } from '@types';
import {
  addHeadingAnchors,
  formatInlineMarkdown,
  headingAnchor,
  headingSlug,
  readKatexCss,
  renderMarkdownMath,
  splitMarkdownForExport,
  stripCustomIdToken,
} from './htmlExport';
import { highlightFencedCodeInHtml } from './codeHighlight';
import {
  buildMermaidExportBootstrapScript,
  getMermaidExportDocumentCss,
  transformMermaidFencesForExport,
  type ExportMermaidTheme,
  type MermaidScriptBundling,
} from './mermaidExport';
import { buildDiagramTocAnchors } from './mermaidFenceUtils';

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
  /** M40：与 HTML 导出一致；PDF 一般用 embedded（离线渲染） */
  mermaidScriptBundling?: MermaidScriptBundling;
  /** M156：导出取消（由上层传入） */
  abortSignal?: AbortSignal;
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
  if (options.abortSignal?.aborted) {
    throw new Error('Export cancelled');
  }
  const opts = { ...defaultOptions, ...options };

  // 注意：ExTester/VS Code UI 测试环境并不一定会为扩展安装 node_modules。
  // 若 puppeteer 在顶层静态导入，会导致扩展激活失败（CustomEditor 不会渲染）。
  // 因此这里改为按需动态加载：仅在真正导出 PDF 时才 require。
  const puppeteerModule = await import('puppeteer');
  const puppeteer = (puppeteerModule as any).default ?? puppeteerModule;

  // 启动 puppeteer（finally 务必关闭；close 异常吞掉以免影响错误传播）
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (options.abortSignal?.aborted) throw new Error('Export cancelled');
    const page = await browser.newPage();

    // 生成 TOC
    let tocHtml = '';
    if (opts.includeToc) {
      tocHtml = generateTocPdf(markdownContent);
    }

    // 转换 Markdown 为 HTML
    const htmlContent = await markdownToPdfHtml(markdownContent);
    if (options.abortSignal?.aborted) throw new Error('Export cancelled');

    // 构建完整 HTML
    const tpl: PdfExportTemplateId = opts.template ?? 'default';
    const fullHtml = buildPdfHtmlDocument(htmlContent, tocHtml, {
      baseHref: opts.baseHref,
      template: tpl,
      mermaidScriptBundling: opts.mermaidScriptBundling ?? 'embedded',
    });

    // 加载页面（内联 Mermaid；等待图表渲染后再打 PDF）
    await page.setContent(fullHtml, { waitUntil: 'load' });
    if (options.abortSignal?.aborted) throw new Error('Export cancelled');
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
    await browser.close().catch(() => undefined);
  }
}

export function generateTocPdf(markdown: string): string {
  const headings: { level: number; text: string; anchor: string }[] = [];
  const lines = markdown.split('\n');
  let inFence = false;
  let headingIndex = 0;

  for (const line of lines) {
    // 围栏代码里的 "# 注释" 不是标题，不能进目录
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headingIndex += 1;
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text, anchor: headingAnchor(text, headingIndex) });
    }
  }

  const diagrams = buildDiagramTocAnchors(markdown);
  if (headings.length === 0 && diagrams.length === 0) return '';

  let tocHtml = '<div class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    // `{#custom-id}` 是锚点语法，不进目录文案（与 HTML 导出目录同规则）
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${escapeHtmlPdf(h.anchor)}">${formatInlineMarkdown(stripCustomIdToken(h.text))}</a></li>`;
  }
  for (const d of diagrams) {
    tocHtml += `<li class="toc-diagram"><a href="#${d.anchor}">${escapeHtmlPdf(d.label)}</a></li>`;
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

  // M290：大文档分段解析（与 HTML 导出一致，避免极端大文档峰值过高）
  const md = renderMarkdownMath(String(markdown ?? ''));
  const segments = splitMarkdownForExport(md, 256_000);
  const parts: string[] = [];
  for (const seg of segments) {
    const part = await marked.parse(seg);
    parts.push(String(part));
  }
  const html = parts.join('\n');

  // 添加锚点到标题（与 HTML 导出同一套锚点规则）
  const withAnchors = addHeadingAnchors(html);

  // 代码块语法高亮（打印同样保留着色；未知语言回退原样）
  const highlighted = await highlightFencedCodeInHtml(withAnchors, 'light');

  return transformMermaidFencesForExport(highlighted, markdown);
}

/** 统一的锚点生成函数（与 webview 大纲 slug 同规则，中文标题可跳转） */
export function generateAnchor(text: string): string {
  return headingSlug(text);
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
      background-color: #faf7f0;
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
  opts?: {
    baseHref?: string;
    template?: PdfExportTemplateId;
    mermaidTheme?: ExportMermaidTheme;
    mermaidScriptBundling?: MermaidScriptBundling;
  }
): string {
  const baseTag = opts?.baseHref ? `<base href="${escapeHtmlPdf(String(opts.baseHref))}">` : '';
  const template: PdfExportTemplateId = opts?.template ?? 'default';
  const bodyClass = `markly-pdf markly-pdf--${template}`;
  const extraCss = getPdfTemplateExtraCss(template);
  const mermaidTheme: ExportMermaidTheme = opts?.mermaidTheme ?? 'default';
  const mermaidBoot = buildMermaidExportBootstrapScript(mermaidTheme, {
    bundling: opts?.mermaidScriptBundling ?? 'embedded',
  });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>导出文档</title>
  ${baseTag}
  <style>
    ${readKatexCss()}
    ${getMermaidExportDocumentCss()}

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
        'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      font-size: 14px;
      line-height: 1.72;
      color: #24292e;
      background-color: #ffffff;
      max-width: 100%;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* 内容样式 */
    .content {
      padding: 40px;
    }

    /* TOC 样式 */
    .toc {
      page-break-after: always;
      padding: 32px 40px;
    }

    .toc h2 {
      font-size: 0.82em;
      font-weight: 600;
      letter-spacing: 0.09em;
      color: #57606a;
      margin: 0 0 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d0d7de;
    }

    .toc ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc li {
      margin: 8px 0;
      line-height: 1.55;
    }

    .toc a {
      color: #24292e;
      text-decoration: none;
    }

    .toc a:hover {
      color: #0969da;
      text-decoration: underline;
    }

    .toc li.toc-diagram a {
      color: #57606a;
    }

    /* 分页 */
    .page-break {
      page-break-after: always;
    }

    /* 标题：层级靠字重与留白拉开 */
    h1, h2, h3, h4, h5, h6 {
      color: #1b1f24;
      font-weight: 650;
      line-height: 1.3;
      letter-spacing: -0.01em;
      margin: 1.6em 0 0.6em;
      page-break-after: avoid;
      break-after: avoid;
    }

    h1:first-child {
      margin-top: 0;
    }

    h1 {
      font-size: 2em;
      font-weight: 700;
      letter-spacing: -0.022em;
      padding-bottom: 0.32em;
      border-bottom: 1px solid #d0d7de;
    }

    h2 {
      font-size: 1.52em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #e7eaee;
    }

    h3 { font-size: 1.26em; }
    h4 { font-size: 1.07em; }
    h5 { font-size: 0.95em; color: #57606a; }
    h6 { font-size: 0.88em; color: #57606a; }

    p {
      margin: 0 0 1.1em;
    }

    p:last-child {
      margin-bottom: 0;
    }

    ul, ol {
      margin: 0 0 1.1em;
      padding-left: 1.6em;
    }

    li {
      margin: 0.3em 0;
    }

    li::marker {
      color: #57606a;
    }

    li > p {
      margin-bottom: 0.5em;
    }

    li > p:last-child {
      margin-bottom: 0;
    }

    .task-list-item,
    li:has(> input[type='checkbox']) {
      list-style: none;
      margin-left: -1.35em;
    }

    input[type='checkbox'] {
      accent-color: #0969da;
      margin-right: 0.5em;
    }

    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'PingFang SC', monospace;
      font-size: 0.875em;
      background-color: #f2f4f7;
      padding: 0.15em 0.4em;
      border-radius: 5px;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    pre {
      background-color: #f6f8fa;
      border: 1px solid #e1e4e8;
      padding: 14px 16px;
      border-radius: 8px;
      margin: 0 0 1.1em;
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
      border: 0;
      padding: 0;
      font-size: 12.5px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    blockquote {
      margin: 0 0 1.1em;
      padding: 0.85em 1.2em;
      color: #57606a;
      background-color: #f6f8fc;
      border-left: 4px solid #4a7fc9;
      border-radius: 0 8px 8px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    blockquote > :last-child {
      margin-bottom: 0;
    }

    /* 表格：表头重复、行尽量不拆开 */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 1.1em;
      font-size: 0.95em;
      border: 1px solid #d0d7de;
    }

    table th, table td {
      border: 1px solid #e1e4e8;
      padding: 8px 12px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: break-word;
    }

    table th {
      background-color: #eef4fd;
      color: #1b1f24;
      font-weight: 600;
      border-bottom-color: #d0d7de;
    }

    tbody tr:nth-child(even) {
      background-color: #fafbfc;
    }

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

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    hr {
      height: 1px;
      border: 0;
      margin: 1.8em 0;
      background-color: #d0d7de;
    }

    .footnote {
      font-size: 0.9em;
      color: #57606a;
      border-top: 1px solid #e7eaee;
      margin-top: 32px;
      padding-top: 16px;
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
