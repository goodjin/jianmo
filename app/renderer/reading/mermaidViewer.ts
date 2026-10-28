/**
 * Mermaid 查看器：预览里点图表 → 父页面弹窗缩放/平移/复制源码。
 */

export const MERMAID_OPEN = 'MARKLY_MERMAID_OPEN';

export interface MermaidOpenPayload {
  svg: string;
  source: string;
}

export function readMermaidOpen(data: unknown): MermaidOpenPayload | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { type?: unknown; svg?: unknown; source?: unknown };
  if (rec.type !== MERMAID_OPEN) return null;
  const svg = typeof rec.svg === 'string' ? rec.svg : '';
  const source = typeof rec.source === 'string' ? rec.source : '';
  if (!svg && !source) return null;
  return { svg, source };
}

export function clampMermaidZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(0.25, value));
}

/** 注入：点击 .mermaid 图表打开查看器。 */
export function mermaidViewerRuntimeSource(): string {
  return `(function(){
    if (window.__marklyMermaidViewer) return;
    window.__marklyMermaidViewer = 1;
    function findDiagram(el) {
      while (el && el !== document) {
        if (el.classList && (el.classList.contains('mermaid') || el.classList.contains('markly-mermaid-await'))) {
          return el;
        }
        el = el.parentNode;
      }
      return null;
    }
    function sourceOf(el) {
      var raw = el.getAttribute('data-markly-source');
      if (raw) return raw;
      var svg = el.querySelector('svg');
      if (svg && svg.getAttribute('aria-label')) return '';
      return (el.getAttribute('data-original-code') || el.textContent || '').trim();
    }
    document.addEventListener('click', function(ev) {
      var diagram = findDiagram(ev.target);
      if (!diagram) return;
      var svgEl = diagram.querySelector('svg');
      var svg = svgEl ? svgEl.outerHTML : '';
      var source = sourceOf(diagram);
      if (!svg && !source) return;
      ev.preventDefault();
      ev.stopPropagation();
      try {
        parent.postMessage({ type: '${MERMAID_OPEN}', svg: svg, source: source }, '*');
      } catch (e) {}
    }, true);
    function tagSources() {
      var nodes = document.querySelectorAll('.mermaid, .markly-mermaid-await');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.getAttribute('data-markly-source')) continue;
        var code = (n.textContent || '').trim();
        if (code && !n.querySelector('svg')) n.setAttribute('data-markly-source', code);
        n.style.cursor = 'zoom-in';
        n.title = n.title || '点击放大查看';
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tagSources);
    } else {
      tagSources();
    }
    setTimeout(tagSources, 800);
    setTimeout(tagSources, 2000);
  })();`;
}
