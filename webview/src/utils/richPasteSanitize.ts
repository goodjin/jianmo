/**
 * Rich 粘贴 / 表格 HTML 前置净化（单一入口）。
 * M13+M14：版本 bump 时请同步单测与本文件常量。
 */

import { hardenPasteDomSubtree } from './pasteDenylist';

/** 语义版本：仅在净化规则破坏性变更时 +1 */
export const RICH_PASTE_HTML_SCHEMA_VERSION = 1 as const;

const LOGGING_FLAG = (): boolean =>
  typeof globalThis !== 'undefined' &&
  Boolean((globalThis as Record<string, unknown>).__MARKLY_VERBOSE_PASTE_SANITIZE__);

/**
 * Word / IM /浏览器剪贴板 HTML → 仍可被 Table 管线 / DOMParser 消费的「较干净」 HTML。
 */
export function sanitizeRichPasteHtml(html: string): string {
  const raw = (html ?? '').trim();
  if (!raw) return raw;

  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    hardenPasteDomSubtree(doc.body);
    const out = doc.body?.innerHTML ?? raw;

    if (LOGGING_FLAG()) {
      // eslint-disable-next-line no-console
      console.debug(`[markly][paste:v${RICH_PASTE_HTML_SCHEMA_VERSION}] len_in=${raw.length} len_out=${out.length}`);
    }
    return out;
  } catch {
    return raw;
  }
}
