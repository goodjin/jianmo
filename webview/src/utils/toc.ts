/**
 * 目录 (TOC) 工具
 * 用于生成、更新 Markdown 文档的目录
 */

import {
  extractCustomHeadingId,
  headingSlug,
  stripCustomIdToken,
} from '../../../src/core/export/headingAnchor';

// TOC 标记
export const TOC_PLACEHOLDER = '<!-- TOC -->';
export const TOC_REGEX = /<!--\s*TOC\s*-->[\s\S]*?(?=<!--\s*\/TOC\s*-->|$)<!--\s*\/TOC\s*-->|<!--\s*TOC\s*-->/i;
export const TOC_START_TAG = '<!-- TOC -->';
export const TOC_END_TAG = '<!-- /TOC -->';

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/**
 * 生成标题 ID（与导出/预览锚点的 slug 同规则，权威实现见 src/core/export/headingAnchor.ts）
 * @param text 标题文本
 * @returns ID
 */
export function generateHeadingId(text: string): string {
  return headingSlug(text);
}

/**
 * 从 Markdown 文本中提取标题
 * @param markdown
 * @returns 标题列表
 */
export function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');

  // 忽略代码块内的内容
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      // 移除已有的 ID 锚点以获取纯文本（与大纲 cleanHeadingText 同规则）
      const rawText = match[2].trim();
      const cleanText = stripCustomIdToken(rawText);

      // 与导出/预览锚点同契约：`{#custom-id}` 优先，其次文本 slug，兜底按出现序号
      const id =
        extractCustomHeadingId(rawText) ||
        generateHeadingId(cleanText) ||
        `markly-h-${headings.length + 1}`;
      headings.push({ level, text: cleanText, id });
    }
  }

  return headings;
}

/**
 * 将标题列表生成为 Markdown TOC
 * @param headings
 * @returns TOC Markdown
 */
export function generateTocMarkdown(headings: TocItem[]): string {
  if (headings.length === 0) {
    return `${TOC_START_TAG}\n${TOC_END_TAG}`;
  }

  let toc = `${TOC_START_TAG}\n## Table of Contents\n\n`;

  for (const heading of headings) {
    const indent = '  '.repeat(heading.level - 1);
    toc += `${indent}- [${heading.text}](#${heading.id})\n`;
  }

  toc += `\n${TOC_END_TAG}`;

  return toc;
}

/**
 * 检查 Markdown 是否包含 TOC 标记
 * @param markdown
 * @returns 是否包含
 */
export function hasToc(markdown: string): boolean {
  return TOC_REGEX.test(markdown);
}

/**
 * 更新 Markdown 中的 TOC
 * @param markdown
 * @returns 更新后的 Markdown
 */
export function updateTocInContent(markdown: string): string {
  const headings = extractHeadings(markdown);
  const tocMarkdown = generateTocMarkdown(headings);

  if (hasToc(markdown)) {
    // 替换已有的 TOC 或插入点
    return markdown.replace(TOC_REGEX, tocMarkdown);
  }

  return markdown;
}
