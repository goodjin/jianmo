import { describe, it, expect } from 'vitest';
import { parseHeadings } from '../outline';
import {
  computeHeadingReorderPermutation,
  getTopLevelHeadingIndices,
  partitionMarkdownByTopLevelHeadings,
  reorderMarkdownTopLevelSections,
} from '../outlineReorder';

describe('partitionMarkdownByTopLevelHeadings', () => {
  it('前言 + 两个一级标题，子标题并入第一节', () => {
    const md = 'intro\n\n# A\na\n## B\nb\n# C\nc\n';
    const h = parseHeadings(md);
    const tops = getTopLevelHeadingIndices(h);
    expect(tops).toEqual([0, 2]);
    const p = partitionMarkdownByTopLevelHeadings(md, h)!;
    expect(p.prefix).toBe('intro\n\n');
    expect(p.sections).toHaveLength(2);
    expect(p.sections[0]).toBe('# A\na\n## B\nb\n');
    expect(p.sections[1]).toBe('# C\nc\n');
  });

  it('全文从二级标题起', () => {
    const md = 'x\n\n## U\nu\n## V\nv\n';
    const h = parseHeadings(md);
    expect(getTopLevelHeadingIndices(h)).toEqual([0, 1]);
    const p = partitionMarkdownByTopLevelHeadings(md, h)!;
    expect(p.prefix).toBe('x\n\n');
    expect(p.sections).toEqual(['## U\nu\n', '## V\nv\n']);
  });
});

describe('computeHeadingReorderPermutation', () => {
  it('同一下标为恒等', () => {
    expect(computeHeadingReorderPermutation(3, 1, 1)).toEqual([0, 1, 2]);
  });

  it('末块移到最前', () => {
    expect(computeHeadingReorderPermutation(3, 2, 0)).toEqual([2, 0, 1]);
  });

  it('首块移到末尾后', () => {
    expect(computeHeadingReorderPermutation(3, 0, 3)).toEqual([1, 2, 0]);
  });

  it('中间块上移', () => {
    expect(computeHeadingReorderPermutation(4, 2, 0)).toEqual([2, 0, 1, 3]);
  });
});

describe('reorderMarkdownTopLevelSections (M62)', () => {
  it('交换两个一级章节', () => {
    const md = 'p\n\n# A\na\n# B\nb\n';
    const h = parseHeadings(md);
    const next = reorderMarkdownTopLevelSections(md, h, 1, 0)!;
    expect(next).toBe('p\n\n# B\nb\n# A\na\n');
  });

  it('子标题随父一级节一起移动', () => {
    const md = '# A\n## A1\n# B\n';
    const h = parseHeadings(md);
    const next = reorderMarkdownTopLevelSections(md, h, 1, 0)!;
    expect(next).toBe('# B\n# A\n## A1\n');
  });
});
