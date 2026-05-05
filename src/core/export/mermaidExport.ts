/**
 * M85：导出 HTML / PDF 时统一将 ```mermaid 围栏转为浏览器内 Mermaid 渲染目标，
 * 与编辑器 `webview/src/config/mermaid.ts` 一致：`startOnLoad: false`、`securityLevel: 'strict'`、可配置 theme。
 */
import * as fs from 'fs';

const FENCE_RE = /<pre><code class="(?:language-)?mermaid">([\s\S]*?)<\/code><\/pre>/gi;

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

/** 放入 HTML 文本节点：仅转义会破坏结构的字符（保留 `>` 等 Mermaid 语法） */
function escapeMermaidDefinitionForHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export type ExportMermaidTheme = 'default' | 'dark' | 'forest' | 'neutral';

/** 注入到 `buildHtmlDocument` / `buildPdfHtmlDocument` 的 `<style>` 内 */
export function getMermaidExportDocumentCss(): string {
  return `
    .markly-mermaid-await {
      margin: 0 0 16px 0;
      overflow-x: auto;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .markly-mermaid-await svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
  `;
}

/**
 * 将 marked 产出的 `<pre><code class="language-mermaid">…</code></pre>` 换成 `<div class="mermaid markly-mermaid-await">…</div>`，
 * 供内联脚本中 `mermaid.run({ querySelector: '.markly-mermaid-await' })` 处理。
 */
export function transformMermaidFencesForExport(html: string): string {
  return html.replace(FENCE_RE, (_full, inner: string) => {
    const definition = decodeBasicHtmlEntities(String(inner));
    return `<div class="mermaid markly-mermaid-await">${escapeMermaidDefinitionForHtmlText(definition)}</div>`;
  });
}

export function readMermaidMinJsFromDisk(): string {
  const rels = ['mermaid/dist/mermaid.min.js', 'mermaid/dist/mermaid.js'];
  for (const rel of rels) {
    try {
      const p = require.resolve(rel);
      return fs.readFileSync(p, 'utf-8');
    } catch {
      /* try next */
    }
  }
  throw new Error('[Markly] 未找到 mermaid 发行文件（mermaid/dist/mermaid.min.js）');
}

/**
 * 内联 mermaid.min.js + DOMContentLoaded 时 initialize + run（HTML 打开文件 / Puppeteer 打印均适用）。
 */
export function buildMermaidExportBootstrapScript(theme: ExportMermaidTheme): string {
  const lib = readMermaidMinJsFromDisk();
  const themeJson = JSON.stringify(theme);
  return `<script>${lib}</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  try {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({ startOnLoad: false, theme: ${themeJson}, securityLevel: 'strict' });
    var p = mermaid.run({ querySelector: '.markly-mermaid-await' });
    if (p && typeof p.then === 'function') p.catch(function (e) { console.error('[Markly mermaid]', e); });
  } catch (e) {
    console.error('[Markly mermaid]', e);
  }
});
</script>`;
}
