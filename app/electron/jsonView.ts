/**
 * 把 JSON / JSONL 渲染成「一个值一个圆角框」。
 * 纯函数：不碰 electron、不碰剪贴板。点选复制由页面脚本 postMessage 交给宿主。
 *
 * 复制约定：
 * - 键：键名原文
 * - 字符串：字符串原文（不加引号）
 * - 数字 / 布尔 / null：JSON 字面量
 * - 对象 / 数组：这一支的 JSON 文本（JSON.stringify）
 * - 点到外层框复制整支，点到里面的框只复制里面那一格
 */
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
  /** 放在框内最前，本身不是可复制的框（例如 JSONL 行号）。 */
  prefix?: string;
}): string {
  return (
    `<div class="box box-${opts.role} box-${opts.shape} kind-${opts.kind}" role="button" tabindex="0" ` +
    `title="点击复制" data-markly-copy="${copyAttr(opts.copyText)}">${opts.prefix ?? ''}${opts.inner}</div>`
  );
}

function renderLeaf(
  role: 'value' | 'element' | 'record',
  kind: 'string' | 'number' | 'boolean' | 'null',
  display: string,
  copyText: string,
  emptyLabel: string,
  prefix = ''
): string {
  return box({
    role,
    shape: 'leaf',
    kind,
    copyText,
    prefix,
    inner: leafBody(display, emptyLabel),
  });
}

function renderPrimitive(
  value: null | boolean | number | string,
  role: 'value' | 'element' | 'record',
  prefix = ''
): string {
  if (value === null) return renderLeaf(role, 'null', 'null', 'null', 'null', prefix);
  if (typeof value === 'boolean') {
    const text = value ? 'true' : 'false';
    return renderLeaf(role, 'boolean', text, text, text, prefix);
  }
  if (typeof value === 'number') {
    const text = JSON.stringify(value);
    return renderLeaf(role, 'number', text, text, text, prefix);
  }
  return renderLeaf(role, 'string', value, value, '空字符串', prefix);
}

function renderKey(key: string): string {
  return box({
    role: 'key',
    shape: 'leaf',
    kind: 'key',
    copyText: key,
    inner: leafBody(key, '空键'),
  });
}

function renderRows(value: { [key: string]: JsonValue }): string {
  const keys = Object.keys(value);
  if (keys.length === 0) return placeholder('空对象');
  return keys
    .map((key) => `<div class="json-row">${renderKey(key)}${renderNode(value[key] as JsonValue, 'value')}</div>`)
    .join('');
}

function renderElements(value: JsonValue[]): string {
  if (value.length === 0) return placeholder('空数组');
  return value.map((item) => renderNode(item, 'element')).join('');
}

function renderNode(value: JsonValue, role: 'value' | 'element' | 'record'): string {
  if (value === null || typeof value !== 'object') {
    return renderPrimitive(value as null | boolean | number | string, role);
  }
  if (Array.isArray(value)) {
    return box({
      role,
      shape: 'array',
      kind: 'array',
      copyText: JSON.stringify(value),
      inner: renderElements(value),
    });
  }
  return box({
    role,
    shape: 'object',
    kind: 'object',
    copyText: JSON.stringify(value),
    inner: renderRows(value),
  });
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
  .json-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
  .box {
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 10px;
    background: var(--bg-color, #fff);
    color: inherit;
    font: inherit;
    line-height: 1.45;
    padding: 4px 10px;
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
  .box-object, .box-array {
    display: flex;
    gap: 8px;
    padding: 8px;
  }
  .box-object { flex-direction: column; align-items: flex-start; }
  .box-array { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
  .jsonl-view { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .record-label {
    flex: 1 0 100%;
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.65;
  }
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
<p class="json-hint">点一下圆角框，这一格的内容就会复制到剪贴板。</p>
${body}
</div>
<script>
(function () {
  var TYPE = ${JSON.stringify(BOX_COPY_MESSAGE)};
  function boxFrom(target) {
    var node = target && target.nodeType === 1 ? target : (target && target.parentElement);
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
  function activate(el) {
    var nodes = document.querySelectorAll('.box.is-selected');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-selected');
    el.classList.add('is-selected');
    parent.postMessage({ type: TYPE, text: readCopy(el) }, '*');
  }
  document.addEventListener('click', function (ev) {
    var el = boxFrom(ev.target);
    if (!el) return;
    // 正在这一格里拖选文字时，留给系统复制选区，不把整格盖掉。
    // 点到外层格子仍复制外层，选区在里面不算点中外层。
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel) !== '' && boxFrom(sel.anchorNode) === el) return;
    ev.preventDefault();
    activate(el);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
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
  return page(renderNode(value, 'value'), '');
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

function lineLabel(lineNo: number, broken = false): string {
  return `<span class="record-label">第 ${lineNo} 行${broken ? ' · 无法解析' : ''}</span>`;
}

function renderJsonlRecord(row: JsonlLine): string {
  if (!row.ok) {
    return box({
      role: 'record',
      shape: 'leaf',
      kind: 'error',
      copyText: row.raw,
      prefix: lineLabel(row.lineNo, true),
      inner:
        `<span class="record-error">${escapeHtml(row.error || '无法解析')}</span>` +
        `<span class="record-raw">${leafBody(row.raw, '空行')}</span>`,
    });
  }
  const value = row.value as JsonValue;
  const label = lineLabel(row.lineNo);
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      return box({
        role: 'record',
        shape: 'array',
        kind: 'array',
        copyText: JSON.stringify(value),
        prefix: label,
        inner: renderElements(value),
      });
    }
    return box({
      role: 'record',
      shape: 'object',
      kind: 'object',
      copyText: JSON.stringify(value),
      prefix: label,
      inner: renderRows(value),
    });
  }
  return renderPrimitive(value as null | boolean | number | string, 'record', label);
}

function renderJsonl(source: string): string {
  const rows = parseJsonl(source);
  if (rows.length === 0) {
    return errorPage('这份 JSONL 是空的', source);
  }
  return page(rows.map(renderJsonlRecord).join(''), 'jsonl-view');
}
