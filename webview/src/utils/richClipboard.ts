/**
 * M87：富文本复制 — 为剪贴板生成邮件/IM 友好的 HTML 片段（配套 text/plain）。
 */
import { marked } from 'marked';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 将 Markdown 片段渲染为可写入 `text/html` 的片段（含 utf-8 提示与根标记）。
 */
export function markdownToClipboardHtml(md: string): string {
  const trimmed = String(md ?? '');
  try {
    const raw = marked.parse(trimmed, { async: false }) as string;
    return `<meta charset="utf-8"><div data-markly-rich-copy="1">${raw}</div>`;
  } catch {
    return `<meta charset="utf-8"><pre data-markly-rich-copy="1">${escapeHtml(trimmed)}</pre>`;
  }
}
