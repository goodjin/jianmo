import { describe, expect, it } from 'vitest';
import { fixMarkdownStructuralPhaseTwo } from '../writingAssistant';
import { looksLikeAtxHeadingLine, repairMarkdownStructureM75 } from '../markdownStructureRepair';

describe('repairMarkdownStructureM75', () => {
  it('clamps heading levels that skip more than one step down the outline', () => {
    const input = '# Title\n\n### Too deep\n\nbody';
    const out = repairMarkdownStructureM75(input);
    expect(out).toContain('## Too deep');
    expect(out).not.toContain('### Too deep');
  });

  it('does not treat ### inside fenced code as headings for hierarchy', () => {
    const input = '# Top\n\n```md\n### In fence\n### still\n```\n\n#### After code\n';
    const out = repairMarkdownStructureM75(input);
    expect(out).toContain('### In fence');
    expect(out).toContain('## After code');
  });

  it('normalizes unordered list markers from * / + to -', () => {
    const out = repairMarkdownStructureM75('* one\n+ two\n');
    expect(out).toBe('- one\n- two\n');
  });

  it('normalizes task checkbox casing', () => {
    expect(repairMarkdownStructureM75('- [X] done\n')).toBe('- [x] done\n');
  });

  it('inserts a blank line between a paragraph and a following heading', () => {
    const out = repairMarkdownStructureM75('Paragraph line\n# Next\n');
    expect(out).toBe('Paragraph line\n\n# Next\n');
  });

  it('inserts a blank line between a heading and the following prose line', () => {
    const out = repairMarkdownStructureM75('# Hello\nImmediate text\n');
    expect(out).toBe('# Hello\n\nImmediate text\n');
  });

  it('does not insert a blank line before a heading right after a list item', () => {
    const out = repairMarkdownStructureM75('- item\n# Section\n');
    expect(out).toBe('- item\n# Section\n');
  });

  it('does not treat a numeric hashtag-like line as a heading', () => {
    expect(looksLikeAtxHeadingLine('#123 tick')).toBe(false);
  });
});

describe('fixMarkdownStructuralPhaseTwo (M75 + whitespace)', () => {
  it('runs structure repair then whitespace normalization', () => {
    const out = fixMarkdownStructuralPhaseTwo('a  \n\n# H\nLine\n');
    expect(out).toContain('# H');
    expect(out).toContain('\n\nLine\n');
    expect(out.endsWith('\n')).toBe(true);
  });
});
