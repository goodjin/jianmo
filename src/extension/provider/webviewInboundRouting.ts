/**
 * Webview → Extension 入站消息的纯判定逻辑（便于单测覆盖 open/save/export 分支）。
 */

export type ExportDocumentIntent =
  | { kind: 'abort'; reason: 'missing_format' | 'missing_document' }
  | { kind: 'preview'; markdown: string }
  /** 需落盘向导出的格式关键字（已由调用方校验非 preview） */
  | { kind: 'persist'; format: string };

export function classifyExportDocumentIntent(
  payload: { format?: string } | undefined,
  doc: { content: string } | undefined
): ExportDocumentIntent {
  const raw = payload?.format;
  const format = typeof raw === 'string' ? raw.trim() : '';
  if (!format) return { kind: 'abort', reason: 'missing_format' };
  if (!doc) return { kind: 'abort', reason: 'missing_document' };
  if (format === 'preview') return { kind: 'preview', markdown: doc.content };
  return { kind: 'persist', format };
}

export type OpenExternalLinkDecision =
  | { action: 'open'; url: string }
  | { action: 'deny'; reason: 'empty' | 'invalid_url' | 'forbidden_scheme' };

/** 对齐 customEditor：`OPEN_EXTERNAL_LINK` 仅允许 http/https（与宿主 openExternal 行为一致）。 */
export function classifyOpenExternalNavigationTarget(urlRaw: unknown): OpenExternalLinkDecision {
  const s = String(urlRaw ?? '').trim();
  if (!s) return { action: 'deny', reason: 'empty' };
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return { action: 'open', url: s };
    return { action: 'deny', reason: 'forbidden_scheme' };
  } catch {
    return { action: 'deny', reason: 'invalid_url' };
  }
}
