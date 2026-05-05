/**
 * 大纲工具函数单元测试
 * @module shared/__tests__/outline
 */

import { describe, it, expect } from 'vitest';
import {
  cleanHeadingText,
  generateHeadingId,
  parseHeadings,
  buildTree,
  collectOutlineFilterIndices,
  getDuplicateHeadingSlugs,
  isHeadingSlugAmbiguous,
  extractMarkdownSectionByHeadingId,
} from '../outline';

describe('parseHeadings', () => {
  it('应该解析 ATX 标题', () => {
    const content = '# Title 1\n## Title 2\n### Title 3';
    const headings = parseHeadings(content);

    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ level: 1, text: 'Title 1', line: 0 });
    expect(headings[1]).toMatchObject({ level: 2, text: 'Title 2', line: 1 });
    expect(headings[2]).toMatchObject({ level: 3, text: 'Title 3', line: 2 });
  });

  it('应该忽略非标题内容', () => {
    const content = '# Title\nsome content\n## Subtitle\n- list item';
    const headings = parseHeadings(content);

    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Title');
    expect(headings[1].text).toBe('Subtitle');
  });

  it('应该正确计算字符位置', () => {
    const content = '# H1\n## H2';
    const headings = parseHeadings(content);

    expect(headings[0].from).toBe(0);
    expect(headings[0].to).toBe(4);
    expect(headings[1].from).toBe(5);
    expect(headings[1].to).toBe(10);
  });

  it('应该支持 1-6 级标题', () => {
    const content = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const headings = parseHeadings(content);

    expect(headings).toHaveLength(6);
    expect(headings.map(h => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('空内容应该返回空数组', () => {
    expect(parseHeadings('')).toEqual([]);
    expect(parseHeadings('no headings here')).toEqual([]);
  });

  it('应该清理显式 heading anchor 并生成稳定 id', () => {
    const headings = parseHeadings('# 长标题 Example {#custom-id}\n## Child');

    expect(headings[0]).toMatchObject({ text: '长标题 Example', from: 0 });
    expect(cleanHeadingText('Title {#id}')).toBe('Title');
    expect(generateHeadingId(headings[0].text)).toBe('长标题-example');
  });
});

describe('getDuplicateHeadingSlugs / isHeadingSlugAmbiguous (M63)', () => {
  it('无重复时返回空集且 slug 不视为歧义', () => {
    const hs = parseHeadings('# A\n## B');
    expect([...getDuplicateHeadingSlugs(hs)].sort()).toEqual([]);
    expect(isHeadingSlugAmbiguous('# A\n## B', 'a')).toBe(false);
    expect(isHeadingSlugAmbiguous('# A\n## B', 'b')).toBe(false);
  });

  it('相同可见标题（因而相同 slug）全部计入重复集', () => {
    const md = '# Hello\n## X\n# Hello\n';
    const dups = getDuplicateHeadingSlugs(parseHeadings(md));
    expect(dups.has('hello')).toBe(true);
    expect(isHeadingSlugAmbiguous(md, 'hello')).toBe(true);
  });

  it('大小写不同但 slug 相同视为冲突', () => {
    const md = '# Hello\n# HELLO\n';
    expect(isHeadingSlugAmbiguous(md, 'hello')).toBe(true);
  });
});

describe('extractMarkdownSectionByHeadingId (M73)', () => {
  it('extracts a heading section until next same-or-higher heading', () => {
    const md = ['# A', 'a1', '## A.1', 'x', '# B', 'b1'].join('\n');
    const sec = extractMarkdownSectionByHeadingId(md, 'a');
    expect(sec).toContain('# A');
    expect(sec).toContain('## A.1');
    expect(sec).not.toContain('# B');
  });
});

describe('collectOutlineFilterIndices (M61)', () => {
  it('空查询返回 null', () => {
    expect(collectOutlineFilterIndices([{ level: 1, text: 'A' }], '   ')).toBe(null);
    expect(collectOutlineFilterIndices([{ level: 1, text: 'A' }], '')).toBe(null);
  });

  it('匹配项含祖先路径', () => {
    const items = [
      { level: 1, text: '第一章' },
      { level: 2, text: '小节' },
      { level: 3, text: '细节 Alpha' },
    ];
    const ix = collectOutlineFilterIndices(items, 'Alpha');
    expect(ix).not.toBe(null);
    expect([...(ix as Set<number>)].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('多个顶级仅匹配相关枝', () => {
    const items = [
      { level: 1, text: 'A' },
      { level: 1, text: 'B' },
      { level: 2, text: 'B-child' },
    ];
    const ix = collectOutlineFilterIndices(items, 'B-ch');
    expect([...(ix as Set<number>)].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('无匹配返回空 Set', () => {
    const items = [{ level: 1, text: 'Only' }];
    const ix = collectOutlineFilterIndices(items, 'zzz');
    expect(ix).not.toBe(null);
    expect((ix as Set<number>).size).toBe(0);
  });

  it('英文大小写不敏感', () => {
    const items = [{ level: 1, text: 'Hello World' }];
    const ix = collectOutlineFilterIndices(items, 'WORLD');
    expect([...(ix as Set<number>)]).toEqual([0]);
  });
});

describe('buildTree', () => {
  it('应该构建简单树结构', () => {
    const headings = parseHeadings('# H1\n## H2\n## H3');
    const tree = buildTree(headings);

    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe('H1');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].text).toBe('H2');
    expect(tree[0].children![1].text).toBe('H3');
  });

  it('应该处理多个顶级标题', () => {
    const headings = parseHeadings('# H1\n# H2\n# H3');
    const tree = buildTree(headings);

    expect(tree).toHaveLength(3);
    expect(tree.map(n => n.text)).toEqual(['H1', 'H2', 'H3']);
  });

  it('应该处理嵌套结构', () => {
    const headings = parseHeadings('# H1\n## H2\n### H3');
    const tree = buildTree(headings);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].children).toHaveLength(1);
    expect(tree[0].children![0].children![0].text).toBe('H3');
  });

  it('空数组应该返回空树', () => {
    expect(buildTree([])).toEqual([]);
  });
});
