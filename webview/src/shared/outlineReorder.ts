import type { HeadingNode } from '../types';

/** 文档中实际出现的最低标题级别（常为 1，亦可能全文从 ## 起） */
export function getMinHeadingLevel(headings: HeadingNode[]): number | null {
  if (headings.length === 0) return null;
  return Math.min(...headings.map((h) => h.level));
}

/** 最低级别标题在 `headings` 中的下标（用于章节块边界） */
export function getTopLevelHeadingIndices(headings: HeadingNode[]): number[] {
  const m = getMinHeadingLevel(headings);
  if (m === null) return [];
  const out: number[] = [];
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].level === m) out.push(i);
  }
  return out;
}

/**
 * 按「最低级别」标题把正文切成前言 + 若干章节块（每块含该标题及其下所有更深层标题，直到下一同级块）。
 */
export function partitionMarkdownByTopLevelHeadings(
  content: string,
  headings: HeadingNode[]
): { prefix: string; sections: string[] } | null {
  const tops = getTopLevelHeadingIndices(headings);
  if (tops.length === 0) return null;
  const prefix = content.slice(0, headings[tops[0]].from);
  const sections: string[] = [];
  for (let k = 0; k < tops.length; k++) {
    const start = headings[tops[k]].from;
    const end = k + 1 < tops.length ? headings[tops[k + 1]].from : content.length;
    sections.push(content.slice(start, end));
  }
  return { prefix, sections };
}

/**
 * 将 `0..n-1` 中 `fromIdx` 移到「紧挨在 `toIdx` 所指标题块之前」。
 * `toIdx === n` 表示移到所有顶级章节之后。
 */
export function computeHeadingReorderPermutation(n: number, fromIdx: number, toIdx: number): number[] | null {
  if (n < 1 || fromIdx < 0 || fromIdx >= n || toIdx < 0 || toIdx > n) return null;
  if (fromIdx === toIdx) return Array.from({ length: n }, (_, i) => i);
  const order = Array.from({ length: n }, (_, i) => i);
  const [moved] = order.splice(fromIdx, 1);
  const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
  order.splice(insertAt, 0, moved);
  return order;
}

/**
 * M62：仅重排「最低大纲级别」章节块（拖动大纲中该级标题行，整 subtree 一起移动）。
 */
export function reorderMarkdownTopLevelSections(
  content: string,
  headings: HeadingNode[],
  fromTopIdx: number,
  toTopIdx: number
): string | null {
  const tops = getTopLevelHeadingIndices(headings);
  if (tops.length < 2) return null;
  const part = partitionMarkdownByTopLevelHeadings(content, headings);
  if (!part) return null;
  const n = tops.length;
  const perm = computeHeadingReorderPermutation(n, fromTopIdx, toTopIdx);
  if (!perm) return null;
  const next = part.prefix + perm.map((i) => part.sections[i]!).join('');
  return next;
}
