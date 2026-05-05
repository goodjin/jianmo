import { describe, expect, it } from 'vitest';

import {
  analyzeMarkdownStructureHints,
  type MarkdownStructureHintKind,
} from '../markdownStructureHints';

function kinds(lines: Array<{ kind: MarkdownStructureHintKind }>): MarkdownStructureHintKind[] {
  return lines.map((x) => x.kind);
}

describe('analyzeMarkdownStructureHints (M77)', () => {
  it('空文档或无标题时返回空数组', () => {
    expect(analyzeMarkdownStructureHints('')).toEqual([]);
    expect(analyzeMarkdownStructureHints('plain\n\nno heading')).toEqual([]);
  });

  it('规整层级无重复时不产生提示', () => {
    const md = `# A\n\n## B\n\n### C\n\ntext\n\n## D\n`;
    expect(analyzeMarkdownStructureHints(md)).toEqual([]);
  });

  it('检测重复 slug：两个相同正文标题各占一条（行号不同）', () => {
    const md = `## Dup\nbody\n\n## Dup\n`;
    const hints = analyzeMarkdownStructureHints(md);
    expect(hints.length).toBe(2);
    expect(new Set(hints.map((h) => h.kind))).toEqual(new Set(['duplicate_anchor' as const]));
    expect(hints.every((h) => h.line === 1 || h.line === 4)).toBe(true);
  });

  it('检测层级断层：H2 后直连 H4', () => {
    const md = `## Two\n\n#### Four\n`;
    const hints = analyzeMarkdownStructureHints(md);
    expect(hints.length).toBe(1);
    expect(hints[0]!.kind).toBe('heading_level_jump');
    expect(hints[0]!.line).toBe(3);
    expect(hints[0]!.message).toContain('H2');
    expect(hints[0]!.message).toContain('H4');
  });

  it('文档以 H3+ 起头时给出开篇提示', () => {
    const md = `### Start\n`;
    const hints = analyzeMarkdownStructureHints(md);
    expect(hints.some((h) => h.kind === 'first_heading_deep')).toBe(true);
    expect(hints.find((h) => h.kind === 'first_heading_deep')!.line).toBe(1);
  });

  it('H1/H2 起头无开篇提示', () => {
    expect(analyzeMarkdownStructureHints(`# x\n`)).toEqual([]);
    expect(analyzeMarkdownStructureHints(`## x\n`)).toEqual([]);
  });

  it('同一片段可同时有重复与断层等多类提示', () => {
    const md = `## A\n\n#### B\n\n## A\n`;
    const hints = analyzeMarkdownStructureHints(md);
    expect(hints.length).toBeGreaterThanOrEqual(3);
    expect(kinds(hints)).toContain('heading_level_jump');
    expect(kinds(hints).filter((k) => k === 'duplicate_anchor').length).toBe(2);
    expect(kinds(hints)).not.toContain('first_heading_deep');
  });

  it('每条提示含可跳转的 from 与非空 headingId', () => {
    const md = `## x\n\n## x\n`;
    for (const h of analyzeMarkdownStructureHints(md)) {
      expect(h.from).toBeGreaterThanOrEqual(0);
      expect(h.headingId.length).toBeGreaterThan(0);
    }
  });
});
