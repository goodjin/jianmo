/**
 * Rich 大文档性能档（M8）
 * 阈值与 docs/m8-large-doc-experience-plan.md 中表格一致；修改时请同步文档。
 */
export const RICH_PERF_T1_CHARS = 80_000;
export const RICH_PERF_T2_CHARS = 180_000;
export const RICH_PERF_T1_LINES = 2000;
export const RICH_PERF_T2_LINES = 4000;

export type RichPerfTier = 0 | 1 | 2;

export function getRichPerfTier(text: string): RichPerfTier {
  const len = text.length;
  const lines = len === 0 ? 0 : text.split('\n').length;
  if (len > RICH_PERF_T2_CHARS || lines > RICH_PERF_T2_LINES) return 2;
  if (len > RICH_PERF_T1_CHARS || lines > RICH_PERF_T1_LINES) return 1;
  return 0;
}
