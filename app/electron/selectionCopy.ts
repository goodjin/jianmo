/**
 * 预览「选择即复制」：iframe 里选区停稳后通知父页面，父页面校验后再交给主进程写剪贴板。
 * 纯函数 + 一段注入脚本，不碰 electron。
 */

export const SELECTION_COPY_TYPE = 'MARKLY_SELECTION_COPY';
export const SELECTION_COPY_DEBOUNCE_MS = 100;
export const SELECTION_COPY_MAX_TEXT = 100_000;

export interface SelectionClipboard {
  text: string;
}

function squash(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * 选区里对不上正文的行丢掉（代码块上的「复制」、标题锚点「#」等）。
 * 一行都对不上就返回 null，避免把文档里没有的字写进剪贴板。
 * 代码缩进保留。
 */
export function textContainedInDocument(selection: string, documentText: string): string | null {
  const hay = squash(documentText);
  if (!hay) return null;
  const kept: string[] = [];
  let substantive = 0;
  let pendingBlanks = 0;
  for (const rawLine of selection.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      pendingBlanks += 1;
      continue;
    }
    if (!hay.includes(squash(rawLine))) {
      pendingBlanks = 0;
      continue;
    }
    if (substantive > 0) {
      for (let i = 0; i < pendingBlanks; i += 1) kept.push('');
    }
    pendingBlanks = 0;
    kept.push(rawLine.replace(/[ \t]+$/g, ''));
    substantive += 1;
  }
  if (substantive === 0) return null;
  const text = kept.join('\n');
  if (!squash(text)) return null;
  return text.length > SELECTION_COPY_MAX_TEXT ? text.slice(0, SELECTION_COPY_MAX_TEXT) : text;
}

export function readSelectionCopyText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { type?: unknown; text?: unknown };
  if (record.type !== SELECTION_COPY_TYPE) return null;
  return typeof record.text === 'string' ? record.text : null;
}

/**
 * 父页面收到 iframe 消息后的闸门：功能开着、来自预览框、文字确实在正文里。
 */
export function acceptSelectionCopyMessage(opts: {
  enabled: boolean;
  fromPreviewFrame: boolean;
  data: unknown;
  documentText: string;
}): SelectionClipboard | null {
  if (!opts.enabled || !opts.fromPreviewFrame) return null;
  const raw = readSelectionCopyText(opts.data);
  if (raw == null || !raw.trim()) return null;
  const text = textContainedInDocument(raw, opts.documentText);
  if (!text) return null;
  return { text };
}

/** 主进程写入前再收一道：必须是非空字符串，超长截断。 */
export function toSelectionClipboardText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const text = (payload as { text?: unknown }).text;
  if (typeof text !== 'string') return null;
  if (!squash(text)) return null;
  return text.length > SELECTION_COPY_MAX_TEXT ? text.slice(0, SELECTION_COPY_MAX_TEXT) : text;
}

/**
 * 注入到预览 iframe 的脚本。选区变化停稳后把纯文本发给父页面。
 * 父页面负责是否真的写入剪贴板（设置关闭时直接丢掉）。
 */
export function selectionCopyRuntimeSource(): string {
  return `(function(){
    if (window.__marklySelectionCopy) return;
    window.__marklySelectionCopy = 1;
    var last = '';
    var timer = null;
    function publish() {
      timer = null;
      var sel = document.getSelection ? document.getSelection() : null;
      if (!sel || sel.isCollapsed || sel.rangeCount < 1) { last = ''; return; }
      var text = String(sel.toString() || '');
      if (!text.trim()) { last = ''; return; }
      if (text === last) return;
      last = text;
      if (text.length > ${SELECTION_COPY_MAX_TEXT}) text = text.slice(0, ${SELECTION_COPY_MAX_TEXT});
      try {
        parent.postMessage({ type: '${SELECTION_COPY_TYPE}', text: text }, '*');
      } catch (e) {}
    }
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(publish, ${SELECTION_COPY_DEBOUNCE_MS});
    }
    document.addEventListener('selectionchange', schedule);
  })();`;
}
