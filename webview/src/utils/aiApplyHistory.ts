/**
 * M79：记录已确认落盘的 AI 选区操作（润色 / 转表），支持按文档偏移撤销（IR/Source）与 Rich 下选区匹配时还原。
 */

export type AiApplyKind = 'rewriteSelection' | 'convertTextToGfmTable';

export interface AiApplyHistoryEntrySource {
  id: string;
  kind: AiApplyKind;
  /** epoch ms */
  ts: number;
  editorMode: 'source';
  /** 替换后插入文本在 Markdown 串中的起始偏移（与 CM6 `sliceDoc`/`doc.toString()` 一致） */
  replaceFrom: number;
  appliedText: string;
  originalText: string;
}

export interface AiApplyHistoryEntryRich {
  id: string;
  kind: AiApplyKind;
  ts: number;
  editorMode: 'rich';
  appliedText: string;
  originalText: string;
}

export type AiApplyHistoryEntry = AiApplyHistoryEntrySource | AiApplyHistoryEntryRich;

export function kindShortLabel(k: AiApplyKind): string {
  return k === 'rewriteSelection' ? '润色' : '转表';
}

/** 新条目插到队首，去重同 id，裁剪长度 */
export function pushAiApplyHistory(
  list: readonly AiApplyHistoryEntry[],
  entry: AiApplyHistoryEntry,
  maxEntries = 15
): AiApplyHistoryEntry[] {
  return [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, maxEntries);
}

export function tryRevertSourceApply(
  fullMarkdown: string,
  entry: AiApplyHistoryEntrySource
): { ok: true; nextDoc: string } | { ok: false; reason: 'range' | 'mismatch' } {
  const { replaceFrom, appliedText, originalText } = entry;
  const end = replaceFrom + appliedText.length;
  if (replaceFrom < 0 || end > fullMarkdown.length) {
    return { ok: false, reason: 'range' };
  }
  if (fullMarkdown.slice(replaceFrom, end) !== appliedText) {
    return { ok: false, reason: 'mismatch' };
  }
  return {
    ok: true,
    nextDoc: `${fullMarkdown.slice(0, replaceFrom)}${originalText}${fullMarkdown.slice(end)}`,
  };
}

/** 撤销一条 Source 记录后：剔除该 id，并对其后未重叠区间的偏移做校正；与被撤区间相交的其它记录丢弃（无法再安全定位）。 */
export function adjustAiApplyHistoryAfterSourceRevert(
  entries: readonly AiApplyHistoryEntry[],
  reverted: AiApplyHistoryEntrySource
): AiApplyHistoryEntry[] {
  const revEnd = reverted.replaceFrom + reverted.appliedText.length;
  const delta = reverted.originalText.length - reverted.appliedText.length;
  const out: AiApplyHistoryEntry[] = [];
  for (const x of entries) {
    if (x.id === reverted.id) continue;
    if (x.editorMode !== 'source') {
      out.push(x);
      continue;
    }
    const xEnd = x.replaceFrom + x.appliedText.length;
    const disjoint = xEnd <= reverted.replaceFrom || x.replaceFrom >= revEnd;
    if (!disjoint) {
      continue;
    }
    if (x.replaceFrom >= revEnd) {
      out.push({ ...x, replaceFrom: x.replaceFrom + delta });
    } else {
      out.push(x);
    }
  }
  return out;
}
