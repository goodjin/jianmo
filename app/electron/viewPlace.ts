/**
 * 预览和源码来回切换时，记下视口上方附近的文字，切过去后仍落在同一处。
 * 两边高度不一样，所以不能只存一个像素。纯函数 + 一段注入预览 iframe 的脚本。
 */

export const PLACE_READ = 'MARKLY_PLACE_READ';
export const PLACE_ANCHOR = 'MARKLY_PLACE_ANCHOR';
export const PLACE_RESTORE = 'MARKLY_PLACE_RESTORE';

export interface PlaceAnchor {
  /** 视口上方附近的一段可读文字。空串表示当时附近没有可对上的字。 */
  snippet: string;
  /** 对不上文字时，用滚动比例兜底（0 在文首，1 在文末）。 */
  ratio: number;
}

export interface SourceMetrics {
  paddingTop: number;
  lineHeight: number;
  scrollHeight: number;
  clientHeight: number;
}

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function squash(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * 去掉标题井号、列表记号和强调符号，让预览里的字能对上源码里的同一句。
 * 太短或只是分隔线时返回空串，调用方再往下找一句。
 */
export function readableSnippet(raw: string, max = 40): string {
  let line = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!line) return '';
  if (/^(```|~~~)/.test(line)) return '';
  if (/^([-*_])\1{2,}$/.test(line.replace(/\s/g, ''))) return '';
  line = line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '');
  line = line.replace(/\s+/g, ' ').trim();
  if (line.length < 2) return '';
  return line.slice(0, max);
}

/**
 * 这次没读到位置（预览没回话）时，沿用上次记下的那一句，避免跳回文首。
 * 读到了新的一句，或确实不在文首的比例，就用新的。
 */
export function keepPlace(next: PlaceAnchor, prev: PlaceAnchor | null): PlaceAnchor {
  if (next.snippet.trim() || next.ratio > 0.001) return next;
  if (prev && (prev.snippet.trim() || prev.ratio > 0.001)) return prev;
  return next;
}

export function readPlaceAnchor(data: unknown): PlaceAnchor | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { type?: unknown; snippet?: unknown; ratio?: unknown };
  if (record.type !== PLACE_ANCHOR) return null;
  const snippet = typeof record.snippet === 'string' ? readableSnippet(record.snippet, 80) || record.snippet.trim().slice(0, 80) : '';
  const ratio = typeof record.ratio === 'number' ? clampRatio(record.ratio) : 0;
  return { snippet: snippet.trim(), ratio };
}

/** 源码框的行高。行高写成倍数时按字号换算，避免把 1.55 当成 1.55 像素。 */
export function measureSourceBox(pre: HTMLElement): SourceMetrics {
  const cs = getComputedStyle(pre);
  const fontSize = parseFloat(pre.style.fontSize) || parseFloat(cs.fontSize) || 14;
  let lineHeight = Number.NaN;
  const raw = cs.lineHeight || '';
  if (raw.endsWith('px')) lineHeight = parseFloat(raw);
  else {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0 && n < 8) lineHeight = fontSize * n;
    else if (Number.isFinite(n) && n >= 8) lineHeight = n;
  }
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = fontSize * 1.55;
  const paddingTop = parseFloat(cs.paddingTop);
  return {
    paddingTop: Number.isFinite(paddingTop) ? paddingTop : 16,
    lineHeight,
    scrollHeight: pre.scrollHeight || 0,
    clientHeight: pre.clientHeight || 0,
  };
}

export function lineIndexAtScroll(scrollTop: number, paddingTop: number, lineHeight: number): number {
  if (!(lineHeight > 0)) return 0;
  const contentY = Math.max(0, scrollTop + 1 - Math.max(0, paddingTop));
  return Math.max(0, Math.floor(contentY / lineHeight));
}

export function scrollTopForLine(lineIndex: number, paddingTop: number, lineHeight: number): number {
  if (!(lineHeight > 0)) return 0;
  return Math.max(0, Math.round(Math.max(0, paddingTop) + Math.max(0, lineIndex) * lineHeight));
}

/** 含这段文字的源码行。对不上返回 -1，交给比例兜底。 */
export function findLineForSnippet(text: string, snippet: string): number {
  const needle = squash(snippet);
  if (needle.length < 2) return -1;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const readable = squash(readableSnippet(line, 400));
    if ((readable && readable.includes(needle)) || squash(line).includes(needle)) return i;
  }
  return -1;
}

export function captureSourceAnchor(text: string, scrollTop: number, metrics: SourceMetrics): PlaceAnchor {
  const lines = text.split('\n');
  const start = lineIndexAtScroll(scrollTop, metrics.paddingTop, metrics.lineHeight);
  let snippet = '';
  const from = Math.max(0, Math.min(start, Math.max(0, lines.length - 1)));
  for (let i = from; i < Math.min(lines.length, from + 8); i += 1) {
    snippet = readableSnippet(lines[i] ?? '');
    if (snippet.length >= 2) break;
    snippet = '';
  }
  if (!snippet) {
    for (let i = from - 1; i >= Math.max(0, from - 6); i -= 1) {
      snippet = readableSnippet(lines[i] ?? '');
      if (snippet.length >= 2) break;
      snippet = '';
    }
  }
  const max = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const ratio = max > 0 ? clampRatio(scrollTop / max) : 0;
  return { snippet, ratio };
}

/** 切到源码后应滚到的位置。优先对上文字，对不上才用比例。 */
export function scrollTopForSource(text: string, anchor: PlaceAnchor, metrics: SourceMetrics): number {
  const line = findLineForSnippet(text, anchor.snippet);
  if (line >= 0) return scrollTopForLine(line, metrics.paddingTop, metrics.lineHeight);
  const max = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  return Math.round(clampRatio(anchor.ratio) * max);
}

/**
 * 注入预览 iframe。沙箱没有 allow-same-origin，父页面不能读正文，只能用 postMessage。
 * 父页面问「现在看到哪」，这里把视口上方的文字回过去；父页面再说「滚到这句」，这里滚过去。
 */
export function placeRuntimeSource(): string {
  return `(function(){
    if (window.__marklyPlace) return;
    window.__marklyPlace = 1;
    function squash(value) {
      return String(value || '').replace(/\\s+/g, '');
    }
    function mapIndex(raw, squashAt) {
      var n = 0;
      for (var i = 0; i < raw.length; i++) {
        if (/\\s/.test(raw.charAt(i))) continue;
        if (n === squashAt) return i;
        n++;
      }
      return raw.length;
    }
    function snippetAtTop() {
      var range = null;
      try {
        if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(24, 12);
      } catch (e) {}
      if (range && range.startContainer && range.startContainer.nodeType === 3) {
        var text = range.startContainer.nodeValue || '';
        var slice = text.slice(range.startOffset).replace(/^\\s+/, '');
        if (slice.length >= 2) return slice.slice(0, 40);
      }
      var el = null;
      try { el = document.elementFromPoint(24, 12); } catch (e2) {}
      if (el && el.closest) {
        var block = el.closest('h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td,th,.box');
        if (block) {
          var blockText = (block.textContent || '').replace(/\\s+/g, ' ').trim();
          if (blockText.length >= 2) return blockText.slice(0, 40);
        }
      }
      return '';
    }
    function scrollRatio() {
      var height = (document.documentElement && document.documentElement.scrollHeight) || 0;
      var view = window.innerHeight || 0;
      var max = height - view;
      if (max < 1) return 0;
      var y = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
      if (y < 0) return 0;
      if (y > max) return 1;
      return y / max;
    }
    function scrollToSnippet(snippet, ratio) {
      var needle = squash(snippet);
      if (needle.length >= 2 && document.body) {
        var walker = document.createTreeWalker(document.body, 4, null);
        var node;
        while ((node = walker.nextNode())) {
          var parent = node.parentNode;
          var tag = parent && parent.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
          var raw = node.nodeValue || '';
          var at = squash(raw).indexOf(needle);
          if (at < 0) continue;
          var start = mapIndex(raw, at);
          var end = mapIndex(raw, at + needle.length - 1) + 1;
          if (start < 0) start = 0;
          if (end <= start) end = Math.min(raw.length, start + 1);
          var range = document.createRange();
          try {
            range.setStart(node, Math.min(start, raw.length));
            range.setEnd(node, Math.min(end, raw.length));
          } catch (e) { continue; }
          var rects = range.getClientRects ? range.getClientRects() : [];
          var rect = rects && rects.length ? rects[0] : range.getBoundingClientRect();
          var base = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
          var top = base + (rect ? rect.top : 0);
          if (top < 0) top = 0;
          try { window.scrollTo(0, top); } catch (e2) { window.scrollTo(0, top); }
          return;
        }
      }
      var height = (document.documentElement && document.documentElement.scrollHeight) || 0;
      var view = window.innerHeight || 0;
      var max = height - view;
      if (max < 0) max = 0;
      var r = typeof ratio === 'number' && isFinite(ratio) ? ratio : 0;
      if (r < 0) r = 0;
      if (r > 1) r = 1;
      window.scrollTo(0, Math.round(r * max));
    }
    window.addEventListener('message', function(ev) {
      var data = ev.data;
      if (!data || !data.type) return;
      if (data.type === '${PLACE_READ}') {
        try {
          parent.postMessage({ type: '${PLACE_ANCHOR}', snippet: snippetAtTop(), ratio: scrollRatio() }, '*');
        } catch (e) {}
        return;
      }
      if (data.type === '${PLACE_RESTORE}') scrollToSnippet(data.snippet, data.ratio);
    });
  })();`;
}
