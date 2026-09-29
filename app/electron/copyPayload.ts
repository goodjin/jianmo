/**
 * 独立应用剪贴板载荷：纯函数，不碰 electron.clipboard。
 *
 * 约定：
 * - text/plain = Markdown 源（贴到编辑器/终端）
 * - text/html  = 预览正文片段（贴到邮件/IM/Word 走富文本）
 * - 预览 HTML 抽 `.content` 内层；抽不到则 html 为空，交给主进程用 markdownToHtml 兜底
 */

export interface ClipboardWritePayload {
  text: string;
  html: string;
}

export function wrapClipboardHtml(contentHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${contentHtml}</body></html>`;
}

/**
 * 从完整导出 HTML 中抽出 `<div class="content">…</div>` 内层。
 * 用深度计数处理正文里嵌套的 mermaid / 表格 div，避免截到内层 `</div>`。
 */
export function extractPreviewContentHtml(fullHtml: string): string {
  const open = '<div class="content">';
  const start = fullHtml.indexOf(open);
  if (start < 0) return '';
  let i = start + open.length;
  let depth = 1;
  while (i < fullHtml.length && depth > 0) {
    const nextOpen = fullHtml.indexOf('<div', i);
    const nextClose = fullHtml.indexOf('</div>', i);
    if (nextClose < 0) return '';
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) {
        return fullHtml.slice(start + open.length, nextClose).trim();
      }
      i = nextClose + 6;
    }
  }
  return '';
}

export function buildClipboardWrite(input: { markdown: string; contentHtml: string }): ClipboardWritePayload {
  const markdown = String(input.markdown ?? '');
  const contentHtml = String(input.contentHtml ?? '').trim();
  return {
    text: markdown,
    html: contentHtml ? wrapClipboardHtml(contentHtml) : '',
  };
}

/**
 * 主进程写入前规范化：renderer 已带 html 则原样用；否则用 markdownToHtml 产物兜底。
 */
export function normalizeCopyPayload(
  payload: { text?: unknown; html?: unknown } | undefined,
  fallbackMarkdown: string,
  fallbackContentHtml: string
): ClipboardWritePayload {
  const text =
    typeof payload?.text === 'string' && payload.text.length > 0 ? payload.text : fallbackMarkdown;
  if (typeof payload?.html === 'string' && payload.html.length > 0) {
    return { text, html: payload.html };
  }
  const fallback = String(fallbackContentHtml ?? '').trim();
  return {
    text,
    html: fallback ? wrapClipboardHtml(fallback) : '',
  };
}
