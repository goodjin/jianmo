/**
 * 预览文内搜索：注入 iframe 的运行时 + 父页面用的消息类型。
 * 沙箱无 allow-same-origin，只能靠 postMessage。
 */

export const SEARCH_FIND = 'MARKLY_SEARCH_FIND';
export const SEARCH_NEXT = 'MARKLY_SEARCH_NEXT';
export const SEARCH_PREV = 'MARKLY_SEARCH_PREV';
export const SEARCH_CLEAR = 'MARKLY_SEARCH_CLEAR';
export const SEARCH_RESULT = 'MARKLY_SEARCH_RESULT';

export interface SearchUiState {
  open: boolean;
  query: string;
  matchCount: number;
  activeIndex: number;
}

export interface TabSearchState {
  open: boolean;
  query: string;
  activeIndex: number;
}

export function emptySearchUi(): SearchUiState {
  return { open: false, query: '', matchCount: 0, activeIndex: -1 };
}

export function emptyTabSearch(): TabSearchState {
  return { open: false, query: '', activeIndex: -1 };
}

export function readSearchResult(data: unknown): { matchCount: number; activeIndex: number } | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { type?: unknown; matchCount?: unknown; activeIndex?: unknown };
  if (rec.type !== SEARCH_RESULT) return null;
  const matchCount = typeof rec.matchCount === 'number' && Number.isFinite(rec.matchCount) ? Math.max(0, Math.floor(rec.matchCount)) : 0;
  const activeIndex =
    typeof rec.activeIndex === 'number' && Number.isFinite(rec.activeIndex) ? Math.floor(rec.activeIndex) : -1;
  return { matchCount, activeIndex };
}

/** 注入预览 iframe：高亮匹配、Enter 下一处、回报计数。 */
export function documentSearchRuntimeSource(): string {
  return `(function(){
    if (window.__marklySearch) return;
    window.__marklySearch = 1;
    var STYLE_ID = 'markly-search-style';
    var marks = [];
    var active = -1;
    var lastQuery = '';

    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return;
      var s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent =
        'mark.markly-search-hit{background:#ffe58f;color:inherit;border-radius:2px;padding:0 1px;}' +
        'mark.markly-search-hit.is-current{background:#ffc53d;outline:2px solid #d48806;outline-offset:1px;}';
      (document.head || document.documentElement).appendChild(s);
    }

    function clearMarks() {
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        var parent = m.parentNode;
        if (!parent) continue;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
        parent.normalize && parent.normalize();
      }
      marks = [];
      active = -1;
    }

    function report() {
      try {
        parent.postMessage({ type: '${SEARCH_RESULT}', matchCount: marks.length, activeIndex: active }, '*');
      } catch (e) {}
    }

    function scrollToActive() {
      if (active < 0 || active >= marks.length) return;
      var el = marks[active];
      if (!el) return;
      try {
        var base = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
        var top = base + el.getBoundingClientRect().top - 48;
        if (top < 0) top = 0;
        window.scrollTo(0, top);
      } catch (e) {
        try { el.scrollIntoView({ block: 'center' }); } catch (e2) {}
      }
    }

    function setActive(index) {
      if (!marks.length) {
        active = -1;
        report();
        return;
      }
      if (index < 0) index = marks.length - 1;
      if (index >= marks.length) index = 0;
      for (var i = 0; i < marks.length; i++) {
        if (i === index) marks[i].classList.add('is-current');
        else marks[i].classList.remove('is-current');
      }
      active = index;
      scrollToActive();
      report();
      try {
        parent.postMessage({
          type: 'MARKLY_NAV_JUMP',
          reason: 'search',
          snippet: (marks[active] && marks[active].textContent || '').slice(0, 40),
          ratio: (function(){
            var h = (document.documentElement && document.documentElement.scrollHeight) || 0;
            var v = window.innerHeight || 0;
            var max = h - v;
            if (max < 1) return 0;
            var y = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
            return Math.min(1, Math.max(0, y / max));
          })()
        }, '*');
      } catch (e) {}
    }

    function collectTextNodes(root) {
      var out = [];
      var walker = document.createTreeWalker(root, 4, null);
      var node;
      while ((node = walker.nextNode())) {
        var p = node.parentNode;
        var tag = p && p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'MARK') continue;
        if (p && p.closest && p.closest('mark.markly-search-hit')) continue;
        if (!(node.nodeValue || '').trim()) continue;
        out.push(node);
      }
      return out;
    }

    function findAll(query) {
      ensureStyle();
      clearMarks();
      lastQuery = query || '';
      var q = String(query || '');
      if (!q) {
        report();
        return;
      }
      var lower = q.toLowerCase();
      var nodes = collectTextNodes(document.body || document.documentElement);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var text = node.nodeValue || '';
        var lowerText = text.toLowerCase();
        var start = 0;
        var parts = [];
        var found = false;
        while (start < text.length) {
          var at = lowerText.indexOf(lower, start);
          if (at < 0) {
            parts.push(document.createTextNode(text.slice(start)));
            break;
          }
          found = true;
          if (at > start) parts.push(document.createTextNode(text.slice(start, at)));
          var mark = document.createElement('mark');
          mark.className = 'markly-search-hit';
          mark.textContent = text.slice(at, at + q.length);
          parts.push(mark);
          marks.push(mark);
          start = at + q.length;
        }
        if (!found) continue;
        var parent = node.parentNode;
        if (!parent) continue;
        for (var j = 0; j < parts.length; j++) parent.insertBefore(parts[j], node);
        parent.removeChild(node);
      }
      if (marks.length) setActive(0);
      else report();
    }

    window.addEventListener('message', function(ev) {
      var data = ev.data;
      if (!data || !data.type) return;
      if (data.type === '${SEARCH_FIND}') {
        findAll(typeof data.query === 'string' ? data.query : '');
        return;
      }
      if (data.type === '${SEARCH_NEXT}') {
        if (!marks.length && lastQuery) findAll(lastQuery);
        else if (marks.length) setActive(active + 1);
        return;
      }
      if (data.type === '${SEARCH_PREV}') {
        if (!marks.length && lastQuery) findAll(lastQuery);
        else if (marks.length) setActive(active - 1);
        return;
      }
      if (data.type === '${SEARCH_CLEAR}') {
        clearMarks();
        lastQuery = '';
        report();
      }
    });

    document.addEventListener('keydown', function(ev) {
      if (!lastQuery) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (ev.shiftKey) {
          if (marks.length) setActive(active - 1);
        } else if (marks.length) setActive(active + 1);
      }
    }, true);
  })();`;
}
