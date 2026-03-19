/**
 * 大纲工具函数
 * @module shared/outline
 * @description 提供标题解析和树形结构构建
 */

import type { HeadingNode } from './types';

/**
 * 解析 Markdown 内容中的标题
 * @param content - Markdown 内容
 * @returns 标题节点列表（扁平结构）
 */
export const parseHeadings = (content: string): HeadingNode[] => {
  const headings: HeadingNode[] = [];
  const lines = content.split('\n');
  let charCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      headings.push({
        level,
        text: atxMatch[2].trim(),
        from: charCount,
        to: charCount + line.length,
        line: i,
      });
    }

    charCount += line.length + 1; // +1 for newline
  }

  return headings;
};

/**
 * 将扁平标题列表构建为树形结构
 * @param headings - 扁平标题列表
 * @returns 树形标题结构
 */
export const buildTree = (headings: HeadingNode[]): HeadingNode[] => {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const heading of headings) {
    const node: HeadingNode = { ...heading, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push(node);
    }

    stack.push(node);
  }

  return root;
};
