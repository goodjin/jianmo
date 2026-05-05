/**
 * M77：长文结构启发式——锚点重复、标题层级断层、开篇层级过深（本地分析，不涉及 AI）。
 */
import { generateHeadingId, getDuplicateHeadingSlugs, parseHeadings } from '../shared/outline';

export type MarkdownStructureHintKind = 'duplicate_anchor' | 'heading_level_jump' | 'first_heading_deep';

export interface MarkdownStructureHint {
  kind: MarkdownStructureHintKind;
  /** 便于阅读的 1-based 行号 */
  line: number;
  headingText: string;
  /** CM6 / IR 跳转用文档偏移 */
  from: number;
  headingId: string;
  /** 单行说明（已含简短标题片段时可读） */
  message: string;
}

const KIND_RANK: Record<MarkdownStructureHintKind, number> = {
  duplicate_anchor: 0,
  first_heading_deep: 1,
  heading_level_jump: 2,
};

function ellipsize(s: string, max = 32): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * 分析 ATX 标题结构问题：重复 slug、层级跳级、文档以 H3+ 起头。
 * 不包含 fence 内外上下文（与 `parseHeadings` 一致）；适合侧栏速览。
 */
export function analyzeMarkdownStructureHints(markdown: string): MarkdownStructureHint[] {
  const md = String(markdown ?? '');
  const headings = parseHeadings(md);
  if (!headings.length) return [];

  const hints: MarkdownStructureHint[] = [];
  const dupSlugs = getDuplicateHeadingSlugs(headings);

  for (const h of headings) {
    const headingId = generateHeadingId(h.text);
    if (dupSlugs.has(headingId)) {
      hints.push({
        kind: 'duplicate_anchor',
        line: h.line + 1,
        headingText: h.text,
        from: h.from,
        headingId,
        message: `「${ellipsize(h.text)}」与其它节生成相同锚点 ID`,
      });
    }
  }

  const first = headings[0]!;
  if (first.level > 2) {
    hints.push({
      kind: 'first_heading_deep',
      line: first.line + 1,
      headingText: first.text,
      from: first.from,
      headingId: generateHeadingId(first.text),
      message: `文档以 H${first.level} 起头，长文可考虑用 H1/H2 便于导航`,
    });
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1]!;
    const cur = headings[i]!;
    if (cur.level > prev.level + 1) {
      hints.push({
        kind: 'heading_level_jump',
        line: cur.line + 1,
        headingText: cur.text,
        from: cur.from,
        headingId: generateHeadingId(cur.text),
        message: `H${prev.level} 后直连 H${cur.level}（缺 H${prev.level + 1}），易在大纲中“断层”`,
      });
    }
  }

  hints.sort((a, b) => a.line - b.line || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
  return hints;
}
