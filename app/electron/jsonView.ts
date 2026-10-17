/**
 * 把 JSON / JSONL 渲染成带连线的树。键、值、数组元素仍各是一个圆角框。
 * 纯函数：不碰 electron、不碰剪贴板。点框复制；点箭头或 JSONL 行号展开/收起。
 *
 * 复制约定：
 * - 键：键名原文
 * - 字符串：字符串原文（不加引号）
 * - 数字 / 布尔 / null：JSON 字面量
 * - 对象 / 数组：这一支的 JSON 文本（JSON.stringify）
 */
import { APP_RADIUS } from '../chromeRadius';
import type { StructuredKind } from './documentKind';

export const BOX_COPY_MESSAGE = 'MARKLY_COPY_BOX';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function readBoxCopyPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { type?: unknown; text?: unknown };
  if (rec.type !== BOX_COPY_MESSAGE) return null;
  if (typeof rec.text !== 'string') return null;
  return rec.text;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 复制文本放进属性。先 JSON.stringify 保住换行，再转义，避免截断标签。 */
function copyAttr(text: string): string {
  return escapeHtml(JSON.stringify(text));
}

function placeholder(label: string): string {
  return `<span class="box-placeholder">${label}</span>`;
}

function leafBody(text: string, emptyLabel: string): string {
  return text.length === 0 ? placeholder(emptyLabel) : escapeHtml(text);
}

function box(opts: {
  role: 'key' | 'value' | 'element' | 'record';
  shape: 'leaf' | 'object' | 'array';
  kind: string;
  copyText: string;
  inner: string;
}): string {
  return (
    `<div class="box box-${opts.role} box-${opts.shape} kind-${opts.kind}" role="button" tabindex="0" ` +
    `title="点击复制" data-markly-copy="${copyAttr(opts.copyText)}">${opts.inner}</div>`
  );
}

function renderPrimitiveBox(value: null | boolean | number | string, role: 'value' | 'element' | 'record'): string {
  if (value === null) return box({ role, shape: 'leaf', kind: 'null', copyText: 'null', inner: 'null' });
  if (typeof value === 'boolean') {
    const text = value ? 'true' : 'false';
    return box({ role, shape: 'leaf', kind: 'boolean', copyText: text, inner: text });
  }
  if (typeof value === 'number') {
    const text = JSON.stringify(value);
    return box({ role, shape: 'leaf', kind: 'number', copyText: text, inner: text });
  }
  return box({ role, shape: 'leaf', kind: 'string', copyText: value, inner: leafBody(value, '空字符串') });
}

function renderKey(key: string): string {
  return box({ role: 'key', shape: 'leaf', kind: 'key', copyText: key, inner: leafBody(key, '空键') });
}

function twistyPad(): string {
  return '<span class="twisty-pad" aria-hidden="true"></span>';
}

function twistyBtn(): string {
  return '<button type="button" class="twisty" aria-expanded="true" aria-label="收起">▾</button>';
}

function pair(keyHtml: string | null, valueHtml: string): string {
  if (!keyHtml) return valueHtml;
  return `<div class="pair">${keyHtml}<span class="pair-link" aria-hidden="true"></span>${valueHtml}</div>`;
}

function leafItem(keyHtml: string | null, valueHtml: string): string {
  return `<li class="node node-leaf"><div class="node-row">${twistyPad()}${pair(keyHtml, valueHtml)}</div></li>`;
}

function branchItem(keyHtml: string | null, valueHtml: string, childrenHtml: string): string {
  return (
    `<li class="node node-branch">` +
    `<div class="node-row">${twistyBtn()}${pair(keyHtml, valueHtml)}</div>` +
    `<ul class="node-children">${childrenHtml}</ul>` +
    `</li>`
  );
}

function childCount(value: JsonValue[]): number;
function childCount(value: { [key: string]: JsonValue }): number;
function childCount(value: JsonValue[] | { [key: string]: JsonValue }): number {
  return Array.isArray(value) ? value.length : Object.keys(value).length;
}

function renderAny(value: JsonValue, role: 'value' | 'element' | 'record', keyHtml: string | null): string {
  if (value !== null && typeof value === 'object') {
    return renderComposite(value, role, keyHtml);
  }
  return leafItem(keyHtml, renderPrimitiveBox(value as null | boolean | number | string, role));
}

function renderComposite(
  value: JsonValue[] | { [key: string]: JsonValue },
  role: 'value' | 'element' | 'record',
  keyHtml: string | null
): string {
  const count = childCount(value);
  const shape = Array.isArray(value) ? 'array' : 'object';
  if (count === 0) {
    const label = shape === 'array' ? '空数组' : '空对象';
    const emptyBox = box({
      role,
      shape,
      kind: shape,
      copyText: JSON.stringify(value),
      inner: placeholder(label),
    });
    return leafItem(keyHtml, emptyBox);
  }
  const summary = box({
    role,
    shape,
    kind: shape,
    copyText: JSON.stringify(value),
    inner: shape === 'array' ? `[${count}]` : `{${count}}`,
  });
  const kids = Array.isArray(value)
    ? value.map((item) => renderAny(item, 'element', null)).join('')
    : Object.keys(value)
        .map((key) => renderAny(value[key] as JsonValue, 'value', renderKey(key)))
        .join('');
  return branchItem(keyHtml, summary, kids);
}

function renderDocument(value: JsonValue): string {
  if (value !== null && typeof value === 'object') {
    if (childCount(value) === 0) {
      const shape = Array.isArray(value) ? 'array' : 'object';
      const label = shape === 'array' ? '空数组' : '空对象';
      return box({
        role: 'value',
        shape,
        kind: shape,
        copyText: JSON.stringify(value),
        inner: placeholder(label),
      });
    }
    return `<ul class="tree">${renderComposite(value, 'value', null)}</ul>`;
  }
  return renderPrimitiveBox(value as null | boolean | number | string, 'value');
}

function page(body: string, extraClass: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Markly</title>
<style>
  html, body { margin: 0; padding: 0; }
  body { background: var(--bg-color, #fff); color: var(--text-color, #24292f); }
  .json-view { padding: 16px 20px 40px; }
  .json-hint { margin: 0 0 14px; font-size: 12px; line-height: 1.5; opacity: 0.72; }
  .json-error-msg { margin: 0 0 10px; color: #cf222e; font-size: 13px; line-height: 1.5; }
  .tree, .node-children { list-style: none; margin: 0; padding: 0; }
  .node-children {
    margin-left: 8px;
    padding-left: 16px;
    border-left: 1px solid var(--border-color, #c5cdd6);
  }
  .node { position: relative; margin: 0; padding: 3px 0; }
  .node-children > .node::before {
    content: "";
    position: absolute;
    left: -16px;
    top: 16px;
    width: 16px;
    border-top: 1px solid var(--border-color, #c5cdd6);
  }
  .node-children > .node:last-child::after {
    content: "";
    position: absolute;
    left: -18px;
    top: 17px;
    bottom: 0;
    width: 3px;
    background: var(--bg-color, #fff);
  }
  .node-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    min-height: 26px;
  }
  .pair { display: inline-flex; align-items: center; max-width: 100%; min-width: 0; }
  .pair-link {
    width: 12px;
    border-top: 1px solid var(--border-color, #c5cdd6);
    flex: 0 0 12px;
  }
  .twisty, .twisty-pad {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    margin-top: 3px;
  }
  .twisty {
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: ${APP_RADIUS.xs};
    background: var(--code-bg, #f6f8fa);
    color: var(--text-color, #24292f);
    padding: 0;
    line-height: 16px;
    font-size: 11px;
    cursor: pointer;
  }
  .node.is-collapsed > .node-children { display: none; }
  .box {
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: ${APP_RADIUS.md};
    background: var(--bg-color, #fff);
    color: inherit;
    font: inherit;
    line-height: 1.45;
    padding: 4px 14px;
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
    cursor: pointer;
  }
  .box-leaf { white-space: pre-wrap; word-break: break-word; }
  .box-key {
    font-weight: 650;
    background: var(--code-bg, #f6f8fa);
    color: var(--link-color, #0969da);
  }
  .jsonl-view { display: flex; flex-direction: column; align-items: flex-start; }
  .jsonl-line {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    column-gap: 8px;
    row-gap: 2px;
    align-items: start;
    margin: 0 0 12px;
  }
  .line-no {
    grid-column: 1;
    grid-row: 1;
    min-width: 1.5em;
    padding-top: 4px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.72;
    cursor: pointer;
    user-select: none;
  }
  .jsonl-line > .twisty { grid-column: 2; grid-row: 1; }
  .jsonl-primitive > .jsonl-body { grid-column: 3; grid-row: 1; }
  .jsonl-branch > .line-summary { grid-column: 3; grid-row: 1; }
  .jsonl-branch > .jsonl-body {
    grid-column: 2 / span 2;
    grid-row: 2;
    margin-left: 8px;
  }
  .jsonl-line.is-collapsed > .jsonl-body { display: none; }
  .kind-number, .kind-boolean, .kind-null, .kind-key {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .box-placeholder { opacity: 0.6; font-size: 12px; }
  .kind-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    border-color: #cf222e;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .box.is-selected { outline: 2px solid var(--link-color, #0969da); outline-offset: 1px; }
</style>
</head>
<body>
<div class="content json-view ${extraClass}">
<p class="json-hint">点圆角框复制这一格。点箭头展开或收起；JSONL 也可以点行号。</p>
${body}
</div>
<script>
(function () {
  var TYPE = ${JSON.stringify(BOX_COPY_MESSAGE)};
  function fromEvent(target) {
    return target && target.nodeType === 1 ? target : (target && target.parentElement);
  }
  function boxFrom(target) {
    var node = fromEvent(target);
    return node && node.closest ? node.closest('[data-markly-copy]') : null;
  }
  function readCopy(el) {
    var raw = el.getAttribute('data-markly-copy');
    if (raw == null) return '';
    try {
      var v = JSON.parse(raw);
      return typeof v === 'string' ? v : '';
    } catch (e) {
      return '';
    }
  }
  function toggle(btn) {
    var node = btn.closest('.node, .jsonl-line');
    if (!node) return;
    var collapsed = node.classList.toggle('is-collapsed');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', collapsed ? '展开' : '收起');
    btn.textContent = collapsed ? '▸' : '▾';
  }
  function activate(el) {
    var nodes = document.querySelectorAll('.box.is-selected');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-selected');
    el.classList.add('is-selected');
    parent.postMessage({ type: TYPE, text: readCopy(el) }, '*');
  }
  document.addEventListener('click', function (ev) {
    var origin = fromEvent(ev.target);
    if (!origin || !origin.closest) return;
    var twisty = origin.closest('.twisty');
    if (twisty) {
      ev.preventDefault();
      toggle(twisty);
      return;
    }
    var lineNo = origin.closest('.line-no');
    if (lineNo) {
      var line = lineNo.closest('.jsonl-line');
      var btn = line && line.querySelector('.twisty');
      if (btn) {
        ev.preventDefault();
        toggle(btn);
      }
      return;
    }
    var el = boxFrom(ev.target);
    if (!el) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel) !== '' && boxFrom(sel.anchorNode) === el) return;
    ev.preventDefault();
    activate(el);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var origin = fromEvent(ev.target);
    if (!origin || !origin.closest) return;
    var twisty = origin.closest('.twisty');
    if (twisty) {
      ev.preventDefault();
      toggle(twisty);
      return;
    }
    var el = boxFrom(ev.target);
    if (!el) return;
    ev.preventDefault();
    activate(el);
  });
})();
</script>
</body>
</html>`;
}

function errorPage(message: string, raw: string): string {
  const body =
    `<p class="json-error-msg">${escapeHtml(message)}</p>` +
    box({
      role: 'value',
      shape: 'leaf',
      kind: 'error',
      copyText: raw,
      inner: leafBody(raw, '空文件'),
    });
  return page(body, '');
}

export function buildStructuredPreviewHtml(content: string, kind: StructuredKind): string {
  const source = stripBom(String(content ?? ''));
  if (kind === 'jsonl') return renderJsonl(source);
  return renderJson(source);
}

function renderJson(source: string): string {
  let value: JsonValue;
  try {
    value = JSON.parse(source) as JsonValue;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errorPage(`无法解析 JSON：${message}`, source);
  }
  return page(renderDocument(value), '');
}

interface JsonlLine {
  lineNo: number;
  raw: string;
  ok: boolean;
  value?: JsonValue;
  error?: string;
}

function parseJsonl(source: string): JsonlLine[] {
  const lines = source.split(/\r?\n/);
  const out: JsonlLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (raw.trim() === '') continue;
    try {
      out.push({ lineNo: i + 1, raw, ok: true, value: JSON.parse(raw) as JsonValue });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      out.push({ lineNo: i + 1, raw, ok: false, error: message });
    }
  }
  return out;
}

function renderJsonlRecord(row: JsonlLine): string {
  const no = `<span class="line-no">${row.lineNo}</span>`;
  const twisty = twistyBtn();
  if (!row.ok) {
    const err = box({
      role: 'record',
      shape: 'leaf',
      kind: 'error',
      copyText: row.raw,
      inner:
        `<span class="record-error">无法解析：${escapeHtml(row.error || '')}</span>` +
        `<span class="record-raw">${leafBody(row.raw, '空行')}</span>`,
    });
    return `<div class="jsonl-line jsonl-primitive">${no}${twisty}<div class="jsonl-body">${err}</div></div>`;
  }
  const value = row.value as JsonValue;
  if (value !== null && typeof value === 'object' && childCount(value) > 0) {
    const summary = Array.isArray(value)
      ? box({
          role: 'record',
          shape: 'array',
          kind: 'array',
          copyText: JSON.stringify(value),
          inner: `[${value.length}]`,
        })
      : box({
          role: 'record',
          shape: 'object',
          kind: 'object',
          copyText: JSON.stringify(value),
          inner: `{${Object.keys(value).length}}`,
        });
    const kids = Array.isArray(value)
      ? value.map((item) => renderAny(item, 'element', null)).join('')
      : Object.keys(value)
          .map((key) => renderAny(value[key] as JsonValue, 'value', renderKey(key)))
          .join('');
    return (
      `<div class="jsonl-line jsonl-branch">${no}${twisty}` +
      `<div class="line-summary">${summary}</div>` +
      `<ul class="node-children jsonl-body">${kids}</ul></div>`
    );
  }
  const leaf =
    value !== null && typeof value === 'object'
      ? box({
          role: 'record',
          shape: Array.isArray(value) ? 'array' : 'object',
          kind: Array.isArray(value) ? 'array' : 'object',
          copyText: JSON.stringify(value),
          inner: placeholder(Array.isArray(value) ? '空数组' : '空对象'),
        })
      : renderPrimitiveBox(value as null | boolean | number | string, 'record');
  return `<div class="jsonl-line jsonl-primitive">${no}${twisty}<div class="jsonl-body">${leaf}</div></div>`;
}

function renderJsonl(source: string): string {
  const rows = parseJsonl(source);
  if (rows.length === 0) {
    return errorPage('这份 JSONL 是空的', source);
  }
  return page(rows.map(renderJsonlRecord).join(''), 'jsonl-view');
}
