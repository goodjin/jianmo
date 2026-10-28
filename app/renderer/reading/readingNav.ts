/**
 * 阅读导航历史：大纲 / 搜索 / 锚点跳转后可后退前进。
 * 与编辑态隔离：只在预览阅读时入栈。
 */

import type { PlaceAnchor } from '../../electron/viewPlace';
import { clampRatio } from '../../electron/viewPlace';

export const NAV_JUMP = 'MARKLY_NAV_JUMP';
export const MAX_NAV_ENTRIES = 80;

export interface NavEntry {
  snippet: string;
  ratio: number;
  reason: 'outline' | 'search' | 'anchor' | 'restore';
}

export interface NavState {
  stack: NavEntry[];
  index: number;
}

export function emptyNavState(): NavState {
  return { stack: [], index: -1 };
}

export function entryFromAnchor(anchor: PlaceAnchor, reason: NavEntry['reason'] = 'restore'): NavEntry {
  return {
    snippet: (anchor.snippet || '').slice(0, 80),
    ratio: clampRatio(anchor.ratio),
    reason,
  };
}

export function sameEntry(a: NavEntry, b: NavEntry): boolean {
  if (Math.abs(a.ratio - b.ratio) > 0.008) return false;
  const as = a.snippet.trim();
  const bs = b.snippet.trim();
  if (as && bs) return as === bs;
  return !as && !bs;
}

/** 跳转前记下当前位置，再压入目标。 */
export function pushNavJump(state: NavState, from: NavEntry, to: NavEntry): NavState {
  let stack = state.stack.slice(0, Math.max(0, state.index + 1));
  if (!stack.length || !sameEntry(stack[stack.length - 1]!, from)) {
    stack = [...stack, from];
  }
  if (!sameEntry(stack[stack.length - 1]!, to)) {
    stack = [...stack, to];
  }
  if (stack.length > MAX_NAV_ENTRIES) {
    const drop = stack.length - MAX_NAV_ENTRIES;
    stack = stack.slice(drop);
  }
  return { stack, index: stack.length - 1 };
}

export function navBack(state: NavState): { state: NavState; entry: NavEntry | null } {
  if (state.index <= 0) return { state, entry: null };
  const index = state.index - 1;
  return { state: { ...state, index }, entry: state.stack[index] ?? null };
}

export function navForward(state: NavState): { state: NavState; entry: NavEntry | null } {
  if (state.index < 0 || state.index >= state.stack.length - 1) return { state, entry: null };
  const index = state.index + 1;
  return { state: { ...state, index }, entry: state.stack[index] ?? null };
}

export function canNavBack(state: NavState): boolean {
  return state.index > 0;
}

export function canNavForward(state: NavState): boolean {
  return state.index >= 0 && state.index < state.stack.length - 1;
}

export function readNavJump(data: unknown): NavEntry | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { type?: unknown; snippet?: unknown; ratio?: unknown; reason?: unknown };
  if (rec.type !== NAV_JUMP) return null;
  const reason =
    rec.reason === 'outline' || rec.reason === 'search' || rec.reason === 'anchor' || rec.reason === 'restore'
      ? rec.reason
      : 'anchor';
  return {
    snippet: typeof rec.snippet === 'string' ? rec.snippet.slice(0, 80) : '',
    ratio: typeof rec.ratio === 'number' ? clampRatio(rec.ratio) : 0,
    reason,
  };
}

/** 注入：锚点点击后通知父页面，便于入栈。 */
export function navJumpNotifyRuntimeSource(): string {
  return `(function(){
    if (window.__marklyNavNotify) return;
    window.__marklyNavNotify = 1;
    function ratio() {
      var h = (document.documentElement && document.documentElement.scrollHeight) || 0;
      var v = window.innerHeight || 0;
      var max = h - v;
      if (max < 1) return 0;
      var y = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
      if (y < 0) return 0;
      if (y > max) return 1;
      return y / max;
    }
    function snippetNear(el) {
      if (!el) return '';
      var t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      return t.slice(0, 40);
    }
    function notify(el, reason) {
      try {
        parent.postMessage({
          type: '${NAV_JUMP}',
          reason: reason || 'anchor',
          snippet: snippetNear(el),
          ratio: ratio()
        }, '*');
      } catch (e) {}
    }
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      while (t && t !== document) {
        if (t.tagName === 'A') {
          var href = t.getAttribute('href') || '';
          if (href.charAt(0) === '#' && href.length > 1) {
            var id;
            try { id = decodeURIComponent(href.slice(1)); } catch (e) { id = href.slice(1); }
            var target = document.getElementById(id);
            setTimeout(function(){ notify(target || t, 'anchor'); }, 0);
          }
          return;
        }
        t = t.parentNode;
      }
    }, true);
    window.addEventListener('message', function(ev) {
      var d = ev.data;
      if (!d || d.type !== 'SCROLL_TO_HEADING' || !d.headingId) return;
      var id;
      try { id = decodeURIComponent(String(d.headingId)); } catch (e) { id = String(d.headingId); }
      var target = document.getElementById(id);
      setTimeout(function(){ notify(target, 'outline'); }, 0);
    });
  })();`;
}
