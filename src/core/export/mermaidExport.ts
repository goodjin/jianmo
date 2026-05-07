/**
 * M85：导出 HTML / PDF 时统一将 ```mermaid 围栏转为浏览器内 Mermaid 渲染目标，
 * 与编辑器 `webview/src/config/mermaid.ts` 一致：`startOnLoad: false`、`securityLevel: 'strict'`、可配置 theme。
 *
 * M40/M43：`mermaidScriptBundling`；围栏可选 `%% alt:` 无障碍标签。
 */
import * as fs from 'fs';

import {
  orderedMermaidFenceAlts,
  marklyDiagramDomId,
  MERMAID_DIAGRAM_ID_PREFIX,
} from './mermaidFenceUtils';

const FENCE_RE = /<pre><code class="(?:language-)?mermaid">([\s\S]*?)<\/code><\/pre>/gi;

export { MERMAID_DIAGRAM_ID_PREFIX, marklyDiagramDomId, orderedMermaidFenceAlts } from './mermaidFenceUtils';

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

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export type ExportMermaidTheme = 'default' | 'dark' | 'forest' | 'neutral';

/** M40：HTML/PDF 内联整包 vs 外链 CDN（体积小，需网络） */
export type MermaidScriptBundling = 'embedded' | 'external';

export const MERMAID_CDN_MIN_JS =
  'https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js';

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
 *
 * @param markdown 原始 Markdown（用于 M43 `%% alt:` 与 M42 稳定 `id` 序号，与围栏出现顺序一致）
 */
export function transformMermaidFencesForExport(html: string, markdown?: string): string {
  const alts = markdown ? orderedMermaidFenceAlts(markdown) : [];
  let idx = 0;
  return html.replace(FENCE_RE, (_full, inner: string) => {
    idx += 1;
    const id = marklyDiagramDomId(idx);
    const definition = decodeBasicHtmlEntities(String(inner));
    const safeDef = escapeMermaidDefinitionForHtmlText(definition);
    const alt = alts[idx - 1];
    const ariaLabel = alt?.length ? escapeAttr(alt) : escapeAttr('Mermaid 图表');
    return `<div id="${id}" class="mermaid markly-mermaid-await" role="img" aria-roledescription="diagram" aria-label="${ariaLabel}" data-markly-mermaid-index="${idx}">${safeDef}</div>`;
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

const MERMAID_BOOT_INLINE = String.raw`
document.addEventListener('DOMContentLoaded', function () {
  try {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({ startOnLoad: false, theme: __THEME__, securityLevel: 'strict' });
    var p = mermaid.run({ querySelector: '.markly-mermaid-await' });
    if (p && typeof p.then === 'function') p.catch(function (e) { console.error('[Markly mermaid]', e); });
  } catch (e) {
    console.error('[Markly mermaid]', e);
  }
});
`;

/**
 * 内联 mermaid.min.js + DOMContentLoaded 时 initialize + run（HTML 打开文件 / Puppeteer 打印均适用）。
 * M40：`bundling === 'external'` 时改从 jsDelivr 拉取同名版本，减小 HTML 体积（需联网）。
 */
export function buildMermaidExportBootstrapScript(
  theme: ExportMermaidTheme,
  options?: { bundling?: MermaidScriptBundling }
): string {
  const themeJson = JSON.stringify(theme);
  const bootJs = MERMAID_BOOT_INLINE.replace('__THEME__', themeJson);
  const bundling = options?.bundling ?? 'embedded';

  if (bundling === 'external') {
    return `<script src="${MERMAID_CDN_MIN_JS}" crossorigin="anonymous"></script>
<script>${bootJs}</script>`;
  }

  const lib = readMermaidMinJsFromDisk();
  return `<script>${lib}</script>
<script>${bootJs}</script>`;
}
