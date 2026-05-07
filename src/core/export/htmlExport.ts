import * as fs from 'fs';
import * as path from 'path';
import * as katex from 'katex';
import { marked } from 'marked';
import { bundleHtmlLocalImages, sanitizeAssetsSubdirectory } from './htmlBundleImages';
import {
  buildMermaidExportBootstrapScript,
  getMermaidExportDocumentCss,
  transformMermaidFencesForExport,
  type MermaidScriptBundling,
} from './mermaidExport';
import { buildDiagramTocAnchors } from './mermaidFenceUtils';

export interface HtmlExportOptions {
  includeToc?: boolean;
  title?: string;
  inlineCss?: boolean;
  darkMode?: boolean;
  /** default：屏读；print-friendly：版心更贴打印、含基础 @media print */
  htmlTheme?: 'default' | 'print-friendly';
  /** M82：将文档目录内本地图片复制到 HTML 输出旁并重写 `<img src>`（默认关闭） */
  copyLocalImages?: boolean;
  /** Markdown 文档所在目录（用于解析相对图片路径）；开启 `copyLocalImages` 时必填 */
  documentBaseDir?: string;
  /** 输出目录下的资产子目录名（单层）；非法值会回退为 `markly-html-assets` */
  assetsSubdirectory?: string;
  /** M40：embedded=内联 mermaid.min.js（默认）；external=CDN（HTML 更小，需联网） */
  mermaidScriptBundling?: MermaidScriptBundling;
  /** M156：导出取消（由上层传入） */
  abortSignal?: AbortSignal;
}

const defaultOptions: HtmlExportOptions = {
  includeToc: true,
  title: '导出文档',
  inlineCss: true,
  darkMode: false,
  htmlTheme: 'default',
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

/**
 * 生成与「导出 HTML」一致的完整文档字符串（不写盘；用于发布前预览等）。
 */
export async function buildExportHtmlString(
  markdownContent: string,
  options: HtmlExportOptions = {}
): Promise<string> {
  const opts = { ...defaultOptions, ...options };

  let tocHtml = '';
  if (opts.includeToc) {
    tocHtml = generateToc(markdownContent);
  }

  const htmlContent = await markdownToHtml(markdownContent);
  return buildHtmlDocument(htmlContent, tocHtml, opts);
}

export async function exportToHtml(
  markdownContent: string,
  outputPath: string,
  options: HtmlExportOptions = {}
): Promise<void> {
  if (options.abortSignal?.aborted) {
    throw new Error('Export cancelled');
  }
  const opts = { ...defaultOptions, ...options };

  let fullHtml = await buildExportHtmlString(markdownContent, opts);
  if (options.abortSignal?.aborted) {
    throw new Error('Export cancelled');
  }

  if (opts.copyLocalImages && opts.documentBaseDir) {
    const docDir = path.resolve(opts.documentBaseDir);
    if (fs.existsSync(docDir)) {
      const sub = sanitizeAssetsSubdirectory(opts.assetsSubdirectory ?? 'markly-html-assets');
      fullHtml = bundleHtmlLocalImages({
        html: fullHtml,
        documentDir: docDir,
        outputHtmlPath: outputPath,
        assetsSubdirectory: sub,
      }).html;
    }
  }

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

  const diagrams = buildDiagramTocAnchors(markdown);
  if (headings.length === 0 && diagrams.length === 0) return '';

  let tocHtml = '<nav class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    // 使用 escapeHtml 防止 XSS
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${h.anchor}">${escapeHtml(h.text)}</a></li>`;
  }
  for (const d of diagrams) {
    tocHtml += `<li class="toc-diagram"><a href="#${d.anchor}">${escapeHtml(d.label)}</a></li>`;
  }
  tocHtml += '</ul></nav>';

  return tocHtml;
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const raw = String(markdown ?? '');
  const md = renderMarkdownMath(raw);
  // M290：大文档分段解析（避免 marked 一次吃下超长字符串导致峰值过高/卡顿）
  const segments = splitMarkdownForExport(md, 256_000);
  const htmlParts: string[] = [];
  for (const seg of segments) {
    // 使用 marked 转换 Markdown，支持 GFM
    const part = await marked.parse(seg, { gfm: true, breaks: true });
    htmlParts.push(String(part));
  }
  const html = htmlParts.join('\n');

  // 添加锚点到标题（修复：处理带属性的标题）
  const withAnchors = String(html).replace(/<h([1-6])([^>]*)>(.+?)<\/h[1-6]>/g, (match, level, attrs, text) => {
    // 如果已经有 id 属性，则保留
    if (/id=["']/.test(attrs)) {
      return match;
    }
    const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    // 使用 escapeHtml 防止 XSS
    return `<h${level} id="${anchor}"${attrs}>${escapeHtml(text)}</h${level}>`;
  });

  return transformMermaidFencesForExport(withAnchors, markdown);
}

/**
 * M290：按行分段导出用 Markdown（best-effort，不跨 fenced code block）。
 * - 仅用于导出链路，避免极端大文档时单次解析峰值过高
 * - 保证代码块结构不被打断
 */
export function splitMarkdownForExport(markdown: string, maxChunkChars: number): string[] {
  const s = String(markdown ?? '');
  if (s.length <= maxChunkChars) return [s];

  const lines = s.split('\n');
  const out: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let inFence = false;

  function flush() {
    if (buf.length === 0) return;
    out.push(buf.join('\n'));
    buf = [];
    bufLen = 0;
  }

  for (const line of lines) {
    // 仅识别 ``` fence（与其它逻辑保持一致；不尝试处理 ~~~）
    if (line.startsWith('```')) {
      inFence = !inFence;
    }
    // 只有不在 fence 内才允许切分
    if (!inFence && bufLen >= maxChunkChars) {
      flush();
    }
    buf.push(line);
    bufLen += line.length + 1;
  }
  flush();
  return out.length ? out : [s];
}

export function renderMarkdownMath(markdown: string): string {
  const codeBlocks: string[] = [];
  const protectedMarkdown = String(markdown ?? '').replace(/```[\s\S]*?```/g, (block) => {
    const token = `@@MARKLY_CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(block);
    return token;
  });

  const rendered = protectedMarkdown
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr) => renderMath(String(expr).trim(), true))
    .replace(/(^|[^$])\$([^\n$]+)\$(?!\$)/g, (_match, prefix, expr) => `${prefix}${renderMath(String(expr).trim(), false)}`);

  return rendered.replace(/@@MARKLY_CODE_BLOCK_(\d+)@@/g, (_match, index) => codeBlocks[Number(index)] ?? '');
}

function renderMath(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return `<code>${escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`)}</code>`;
  }
}

export function readKatexCss(): string {
  try {
    const cssPath = require.resolve('katex/dist/katex.min.css');
    return fs.readFileSync(cssPath, 'utf-8');
  } catch {
    try {
      return fs.readFileSync(path.join(process.cwd(), 'node_modules/katex/dist/katex.min.css'), 'utf-8');
    } catch {
      return '';
    }
  }
}

export function buildHtmlDocument(content: string, tocHtml: string, opts: HtmlExportOptions): string {
  const { darkMode } = opts;
  const printFriendly = opts.htmlTheme === 'print-friendly';
  const bodyClass = printFriendly ? 'markly-export-print-friendly' : '';
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
    ${readKatexCss()}
    ${getMermaidExportDocumentCss()}
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

    /* 代码（M84：长行换行；打印时 pre 可跨页） */
    code {
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    pre {
      background-color: var(--code-bg);
      padding: 16px;
      overflow-x: auto;
      overflow-y: hidden;
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
    }

    pre code {
      background: transparent;
      padding: 0;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
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

    ${
      printFriendly
        ? `
    body.markly-export-print-friendly {
      max-width: none;
      font-size: 11pt;
      padding: 24px 12px;
    }
    body.markly-export-print-friendly pre {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
    }
    `
        : ''
    }

    /* 打印样式（M84：围栏代码可跨页；blockquote 仍尽量整块） */
    @media print {
      body {
        max-width: 100%;
        padding: 0;
      }

      .toc {
        page-break-after: always;
      }

      pre {
        page-break-inside: auto;
        break-inside: auto;
        white-space: pre-wrap;
        overflow: visible;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      pre code {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      blockquote {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* M32：分页时尽量重复表头（依赖 UA 对 thead 的表格头组语义） */
      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      table {
        page-break-inside: auto;
        break-inside: auto;
      }

      tr,
      th,
      td {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  ${tocHtml}
  <div class="content">
    ${content}
  </div>
${buildMermaidExportBootstrapScript(opts.darkMode ? 'dark' : 'default', {
    bundling: opts.mermaidScriptBundling ?? 'embedded',
  })}
</body>
</html>`;
}
