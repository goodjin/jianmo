import { describe, expect, it } from 'vitest';

import {
  adjustAiApplyHistoryAfterSourceRevert,
  pushAiApplyHistory,
  tryRevertSourceApply,
  type AiApplyHistoryEntry,
  type AiApplyHistoryEntrySource,
} from '../aiApplyHistory';

const base: AiApplyHistoryEntrySource = {
  id: '1',
  ts: 1,
  kind: 'rewriteSelection',
  editorMode: 'source',
  replaceFrom: 3,
  originalText: 'old',
  appliedText: 'NEW',
};

describe('aiApplyHistory (M79)', () => {
  it('pushAiApplyHistory keeps newest first and caps size', () => {
    const a: AiApplyHistoryEntry = { ...base, id: 'a', ts: 1 };
    const b: AiApplyHistoryEntry = { ...base, id: 'b', ts: 2 };
    const c: AiApplyHistoryEntry = { ...base, id: 'c', ts: 3 };
    let list: AiApplyHistoryEntry[] = [];
    list = pushAiApplyHistory(list, a, 2);
    list = pushAiApplyHistory(list, b, 2);
    list = pushAiApplyHistory(list, c, 2);
    expect(list.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('tryRevertSourceApply restores original when slice still matches applied', () => {
    const doc = 'ab NEW tail';
    expect(tryRevertSourceApply(doc, base)).toEqual({ ok: true, nextDoc: 'ab old tail' });
  });

  it('tryRevertSourceApply fails on mismatch or range', () => {
    expect(tryRevertSourceApply('xx', base).ok).toBe(false);
    expect(tryRevertSourceApply('abcXXX tail', base).ok).toBe(false);
  });

  it('adjustAiApplyHistoryAfterSourceRevert shifts later offsets and drops overlaps', () => {
    const rev: AiApplyHistoryEntrySource = { ...base, id: 'r', replaceFrom: 2, originalText: 'o', appliedText: 'LONG' };
    const overlap: AiApplyHistoryEntrySource = { ...base, id: 'a', replaceFrom: 3, appliedText: 'yy', originalText: 'z' }; // 与 [2,6) 相交
    const later: AiApplyHistoryEntrySource = {
      ...base,
      id: 'b',
      replaceFrom: 10,
      appliedText: 'z',
      originalText: 'w',
    };
    const adjusted = adjustAiApplyHistoryAfterSourceRevert([overlap, rev, later], rev);
    expect(adjusted.find((x) => x.id === 'r')).toBeUndefined();
    expect(adjusted.find((x) => x.id === 'a')).toBeUndefined();
    const lb = adjusted.find((x) => x.id === 'b') as AiApplyHistoryEntrySource | undefined;
    expect(lb?.replaceFrom).toBe(
      later.replaceFrom + (rev.originalText.length - rev.appliedText.length)
    );
  });
});
