import * as fs from 'fs';
import * as path from 'path';
import * as katex from 'katex';
import { marked } from 'marked';
import { bundleHtmlLocalImages, sanitizeAssetsSubdirectory } from './htmlBundleImages';
import {
  decodeBasicEntities,
  highlightFencedCodeInHtml,
  type CodeHighlightTheme,
} from './codeHighlight';
import { buildExportHtmlStyle } from './exportHtmlStyle';
import {
  buildMermaidExportBootstrapScript,
  getMermaidExportDocumentCss,
  transformMermaidFencesForExport,
  type MermaidScriptBundling,
} from './mermaidExport';
import { buildDiagramTocAnchors } from './mermaidFenceUtils';
import { headingAnchor, stripCustomIdToken } from './headingAnchor';

// 标题锚点契约的权威实现在 headingAnchor.ts；此处再导出，保持既有调用面稳定。
export {
  extractCustomHeadingId,
  stripCustomIdToken,
  headingAnchor,
  headingSlug,
  stripInlineMarkup,
} from './headingAnchor';

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

/* ========== 标题锚点：权威实现见 ./headingAnchor.ts（导出/预览/大纲共用契约） ========== */

/** 目录标签：转义后再还原少量行内标记，既保留强调又杜绝注入。 */
export function formatInlineMarkdown(text: string): string {
  let out = escapeHtml(String(text ?? ''));
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/** 渲染后的标题内层 HTML → 纯文本（剥掉标签与 KaTeX 的 MathML 重复朗读层）。 */
function plainTextFromHeadingHtml(inner: string): string {
  return decodeBasicEntities(
    String(inner ?? '')
      .replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, '')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 给渲染后的 HTML 标题补 `id`（已有 id 保留）。
 * 导出 HTML / PDF 两条链路共用，保证目录、大纲、预览跳转指向同一套锚点。
 */
export function addHeadingAnchors(html: string): string {
  let headingIndex = 0;
  return String(html).replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (match, level, attrs, inner) => {
      headingIndex += 1;
      // 如果已经有 id 属性，则保留
      if (/id=["']/.test(attrs)) {
        return match;
      }
      const fullText = plainTextFromHeadingHtml(inner);
      const anchor = headingAnchor(fullText, headingIndex);
      // 尾部的 `{#custom-id}` 是锚点语法不是文案，渲染时剥掉（尾部普通文本才会命中，行内代码里的不受影响）
      const displayInner = stripCustomIdToken(inner);
      return `<h${level} id="${escapeHtml(anchor)}"${attrs}>${displayInner}</h${level}>`;
    }
  );
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

  const htmlContent = await markdownToHtml(markdownContent, {
    codeTheme: opts.darkMode ? 'dark' : 'light',
  });
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

  let tocHtml = '<nav class="toc"><h2>目录</h2><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 20;
    // 使用 escapeHtml 防止 XSS；`{#custom-id}` 是锚点语法，不进目录文案
    tocHtml += `<li style="margin-left: ${indent}px"><a href="#${escapeHtml(h.anchor)}">${formatInlineMarkdown(stripCustomIdToken(h.text))}</a></li>`;
  }
  for (const d of diagrams) {
    tocHtml += `<li class="toc-diagram"><a href="#${d.anchor}">${escapeHtml(d.label)}</a></li>`;
  }
  tocHtml += '</ul></nav>';

  return tocHtml;
}

export interface MarkdownToHtmlOptions {
  /** 代码块语法高亮主题；默认随导出亮色 */
  codeTheme?: CodeHighlightTheme;
}

export async function markdownToHtml(
  markdown: string,
  options: MarkdownToHtmlOptions = {}
): Promise<string> {
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

  // 添加锚点到标题：标题内层（含强调/行内代码/链接）原样保留，只补 id
  const withAnchors = addHeadingAnchors(html);

  // 代码块语法高亮（未知语言/失败自动回退原样）
  const highlighted = await highlightFencedCodeInHtml(withAnchors, options.codeTheme ?? 'light');

  return transformMermaidFencesForExport(highlighted, markdown);
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

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title || '导出文档')}</title>
  <style>
    ${readKatexCss()}
    ${getMermaidExportDocumentCss()}
  </style>
${buildExportHtmlStyle({ darkMode, printFriendly })}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  ${tocHtml}
  <div class="content">
    ${content}
  </div>
  <script>
  /* 文档运行时增强（渐进增强，脚本被禁用时文档依旧完整可读）：
     1) 显式拦截 #锚点点击：iframe sandbox 在不同浏览器对 hash-only 跳转行为不一致，
        由脚本自行 scrollIntoView 保证跳转生效；同时挂 mousedown/pointerdown 三道保险。
     2) 代码块：语言标签 + 一键复制；
     3) 宽表格：横向滚动包装；
     4) 标题：悬停显示锚点链接。 */
  (function(){
      function resolve(ev) {
          var t = ev.target;
          while (t && t !== document) {
              if (t.tagName === 'A') return t;
              t = t.parentNode;
          }
          return null;
      }
      /* 跳转统一走「算坐标 + window.scrollTo(instant)」：
         scrollIntoView 在沙箱 iframe（桌面端预览）里观察到不生效，scrollTo 可靠；
         顶部留 16px 呼吸位（与标题 scroll-margin-top 对齐）。 */
      function scrollToTarget(target) {
          if (!target) return false;
          var base = window.pageYOffset || document.documentElement.scrollTop || 0;
          var top = base + target.getBoundingClientRect().top - 16;
          if (top < 0) top = 0;
          try {
              window.scrollTo({ top: top, behavior: 'instant' });
          } catch (e) {
              window.scrollTo(0, top);
          }
          return true;
      }
      function jumpTo(href) {
          if (!href || href.charAt(0) !== '#' || href.length < 2) return false;
          var raw = href.slice(1);
          var id;
          try { id = decodeURIComponent(raw); } catch (e) { id = raw; }
          var target = document.getElementById(id);
          if (!target) return false;
          scrollToTarget(target);
          try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
          return true;
      }
      function handler(ev) {
          var a = resolve(ev);
          if (!a) return;
          if (jumpTo(a.getAttribute('href') || '')) {
              ev.preventDefault();
              ev.stopPropagation();
          }
      }
      document.addEventListener('click', handler, true);
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('pointerdown', handler, true);
      /* 父 renderer 通过 postMessage 通知跳转（沙箱无 allow-same-origin，
         父无法直接操作 contentDocument；postMessage 是跨 origin 唯一可靠通道）。 */
      window.addEventListener('message', function(ev) {
          var d = ev.data;
          if (!d || d.type !== 'SCROLL_TO_HEADING' || !d.headingId) return;
          var id;
          try { id = decodeURIComponent(String(d.headingId)); } catch (e) { id = String(d.headingId); }
          var target = document.getElementById(id);
          if (!target) return;
          scrollToTarget(target);
          try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
      });

      function fallbackCopy(text, done) {
          try {
              var ta = document.createElement('textarea');
              ta.value = text;
              ta.setAttribute('readonly', '');
              ta.style.position = 'fixed';
              ta.style.left = '-9999px';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              done();
          } catch (e) { /* 沙箱里复制不可用时静默失败 */ }
      }
      function copyText(text, done) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(done, function() { fallbackCopy(text, done); });
          } else {
              fallbackCopy(text, done);
          }
      }

      function enhanceCodeBlocks(root) {
          var pres = root.querySelectorAll('pre');
          for (var i = 0; i < pres.length; i++) {
              var pre = pres[i];
              if (pre.parentNode && pre.parentNode.classList && pre.parentNode.classList.contains('markly-codeblock')) continue;
              var codeEl = pre.querySelector('code');
              var wrap = document.createElement('div');
              wrap.className = 'markly-codeblock';
              pre.parentNode.insertBefore(wrap, pre);
              wrap.appendChild(pre);

              var lang = '';
              if (codeEl) {
                  var m = (codeEl.getAttribute('class') || '').match(/language-([\\w#+.\\-]+)/);
                  if (m) lang = m[1];
              }
              if (lang) {
                  var chip = document.createElement('span');
                  chip.className = 'markly-code-lang';
                  chip.textContent = lang;
                  wrap.appendChild(chip);
              }
              if (codeEl) {
                  var btn = document.createElement('button');
                  btn.type = 'button';
                  btn.className = 'markly-code-copy';
                  btn.textContent = '复制';
                  btn.addEventListener('click', (function(preEl, button) {
                      return function() {
                          copyText(preEl.textContent || '', function() {
                              button.textContent = '已复制';
                              setTimeout(function() { button.textContent = '复制'; }, 1200);
                          });
                      };
                  })(pre, btn));
                  wrap.appendChild(btn);
              }
          }
      }

      function enhanceTables(root) {
          var tables = root.querySelectorAll('table');
          for (var i = 0; i < tables.length; i++) {
              var table = tables[i];
              if (table.parentNode && table.parentNode.classList && table.parentNode.classList.contains('markly-table-wrap')) continue;
              var wrap = document.createElement('div');
              wrap.className = 'markly-table-wrap';
              table.parentNode.insertBefore(wrap, table);
              wrap.appendChild(table);
          }
      }

      function enhanceHeadings(root) {
          var hs = root.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
          for (var i = 0; i < hs.length; i++) {
              var el = hs[i];
              if (el.querySelector('.markly-anchor')) continue;
              var id = el.getAttribute('id');
              if (!id) continue;
              var a = document.createElement('a');
              a.className = 'markly-anchor';
              a.href = '#' + id;
              a.textContent = '#';
              a.setAttribute('aria-label', '本节锚点');
              el.insertBefore(a, el.firstChild);
          }
      }

      function enhance() {
          var root = document.querySelector('.content');
          if (!root) return;
          enhanceCodeBlocks(root);
          enhanceTables(root);
          enhanceHeadings(root);
      }

      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', enhance);
      } else {
          enhance();
      }
  })();
  </script>
${buildMermaidExportBootstrapScript(opts.darkMode ? 'dark' : 'default', {
    bundling: opts.mermaidScriptBundling ?? 'embedded',
  })}
</body>
</html>`;
}
