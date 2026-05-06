/**
 * 大纲工具函数
 * @module shared/outline
 * @description 提供标题解析和树形结构构建
 */

import type { HeadingNode } from '../types';

export const cleanHeadingText = (text: string): string => {
  return String(text ?? '').replace(/\s+\{#[^}]+\}\s*$/, '').trim();
};

export const generateHeadingId = (text: string): string => {
  return cleanHeadingText(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * M63：按 `generateHeadingId` 规则统计各 slug 出现次数，返回出现 ≥2 次的 slug 集合（锚点冲突）。
 */
export function getDuplicateHeadingSlugs(headings: ReadonlyArray<{ text: string }>): Set<string> {
  const counts = new Map<string, number>();
  for (const h of headings) {
    const id = generateHeadingId(h.text);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [id, n] of counts) {
    if (n > 1) dups.add(id);
  }
  return dups;
}

/** M63：当前文档中该 `headingId`（与大纲/Rich 一致的 slug）是否与别节重复。 */
export function isHeadingSlugAmbiguous(content: string, headingId: string): boolean {
  return getDuplicateHeadingSlugs(parseHeadings(content)).has(headingId);
}

/**
 * M73：按标题 slug 提取该章节 Markdown（含标题行本身，直到下一条同级或更高标题）。
 * 找不到时返回 null。
 */
export function extractMarkdownSectionByHeadingId(content: string, headingId: string): string | null {
  const md = String(content ?? '');
  const hs = parseHeadings(md);
  if (!hs.length) return null;
  const ix = hs.findIndex((h) => generateHeadingId(h.text) === headingId);
  if (ix < 0) return null;
  const h = hs[ix]!;
  // from: 行首；parseHeadings 的 from 指向整行起点
  const from = h.from;
  let to = md.length;
  for (let j = ix + 1; j < hs.length; j++) {
    const next = hs[j]!;
    if (next.level <= h.level) {
      to = next.from;
      break;
    }
  }
  return md.slice(from, to).trim();
}

/**
 * M61：按标题子串筛选应保留的大纲下标（含每个匹配项的祖先标题，便于定位章节）。
 * `query` 经 `trim` 后若为空，返回 `null` 表示调用方走「未筛选」逻辑（如折叠态）。
 * 匹配不区分大小写（`toLowerCase`）；中文等直接 `includes`。
 */
export function collectOutlineFilterIndices(
  items: ReadonlyArray<{ level: number; text: string; kind?: 'heading' | 'diagram' }>,
  query: string
): Set<number> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const set = new Set<number>();
  for (let j = 0; j < items.length; j++) {
    if (!items[j].text.toLowerCase().includes(q)) continue;
    set.add(j);
    if (items[j].kind === 'diagram') continue;
    let L = items[j].level;
    for (let i = j - 1; i >= 0; i--) {
      if (items[i].kind === 'diagram') continue;
      if (items[i].level < L) {
        set.add(i);
        L = items[i].level;
      }
    }
  }
  return set;
}

/** 解析 Markdown 中的 ATX 标题为扁平列表（含 `from`/`to`/`line`）。 */
export const parseHeadings = (content: string): HeadingNode[] => {
  const headings: HeadingNode[] = [];
  const lines = content.split('\n');
  let charCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = cleanHeadingText(atxMatch[2]);
      headings.push({
        level,
        text,
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
