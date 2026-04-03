/**
 * Vitest 全局 DOM 补齐：让 CodeMirror 6 在 jsdom 下少报 “Not implemented” / createRange 问题。
 * 仅在有 document 的环境执行（根 Vitest 里 extension 用例跑 node 时会跳过）。
 */

export {};

function ensureCreateRange(): void {
  if (typeof document === 'undefined') return;
  const doc = document as Document & { createRange?: () => Range };
  if (typeof doc.createRange === 'function') return;

  doc.createRange = function createRangePolyfill(): Range {
    const range = {
      commonAncestorContainer: (doc.body ?? doc.documentElement) as Node,
      setStart() {},
      setEnd() {},
      setStartBefore() {},
      setEndBefore() {},
      setStartAfter() {},
      setEndAfter() {},
      selectNode() {},
      selectNodeContents() {},
      collapse() {},
      cloneRange() {
        return range as unknown as Range;
      },
      detach() {},
      getClientRects() {
        return [] as unknown as DOMRectList;
      },
      getBoundingClientRect() {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
      START_TO_START: 0,
      START_TO_END: 1,
      END_TO_END: 2,
      END_TO_START: 3,
      compareBoundaryPoints() {
        return 0;
      },
    };
    return range as unknown as Range;
  };
}

function patchRangePrototype(): void {
  if (typeof Range === 'undefined') return;
  const proto = Range.prototype as Range & {
    getClientRects?: () => DOMRectList;
    getBoundingClientRect?: () => DOMRect;
  };
  if (!proto.getClientRects) {
    proto.getClientRects = () => [] as unknown as DOMRectList;
  }
  if (!proto.getBoundingClientRect) {
    proto.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

function ensureGetSelection(): void {
  if (typeof document === 'undefined') return;
  ensureCreateRange();
  if (document.getSelection) return;

  (document as unknown as { getSelection: () => Selection }).getSelection = () =>
    ({
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      isCollapsed: true,
      rangeCount: 0,
      type: 'None',
      addRange: () => {},
      collapse: () => {},
      collapseToEnd: () => {},
      collapseToStart: () => {},
      containsNode: () => false,
      deleteFromDocument: () => {},
      empty: () => {},
      extend: () => {},
      getRangeAt: () => document.createRange(),
      removeAllRanges: () => {},
      removeRange: () => {},
      selectAllChildren: () => {},
      setBaseAndExtent: () => {},
      setPosition: () => {},
      toString: () => '',
    }) as Selection;

  if (typeof window !== 'undefined' && !window.getSelection) {
    (window as unknown as { getSelection: typeof document.getSelection }).getSelection =
      document.getSelection.bind(document);
  }
}

function ensureGetComputedStyle(): void {
  if (typeof window === 'undefined') return;
  if (typeof window.getComputedStyle === 'function') return;

  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value: () => ({
      getPropertyValue: () => '',
      lineHeight: '20px',
      fontSize: '14px',
    }),
  });
}

/** jsdom 对 prompt 会打 Error 日志，测试里统一为静默 null，业务侧用 promptInput 或默认值兜住 */
function silenceJsdomePrompt(): void {
  if (typeof window === 'undefined') return;
  Object.defineProperty(window, 'prompt', {
    configurable: true,
    writable: true,
    value: () => null,
  });
}

function setup(): void {
  ensureCreateRange();
  patchRangePrototype();
  ensureGetSelection();
  ensureGetComputedStyle();
  silenceJsdomePrompt();
}

setup();
