/**
 * 大纲工具函数单元测试
 * @module shared/__tests__/outline
 */

import { describe, it, expect } from 'vitest';
import { parseHeadings, buildTree } from '../outline';

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
