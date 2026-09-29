import * as fs from 'fs';
import * as path from 'path';
import { DIR_MD_PAGE_SIZE, isMarkdownFileName, paginateItems } from './recentFiles';

export interface DirMarkdownFile {
  path: string;
  name: string;
}

export interface DirMarkdownPage {
  dir: string;
  files: DirMarkdownFile[];
  hasMore: boolean;
  nextOffset: number;
}

export function emptyDirMarkdownPage(dir: string, offset = 0): DirMarkdownPage {
  return { dir, files: [], hasMore: false, nextOffset: Math.max(0, offset) };
}

/**
 * 列出目录下的 Markdown 文件（仅当前层，不递归），按文件名排序后分页。
 * 目录不存在 / 不可读 → 空页，不抛。
 */
export function listMarkdownFilesPage(
  dir: string,
  offset = 0,
  pageSize: number = DIR_MD_PAGE_SIZE
): DirMarkdownPage {
  const resolved = typeof dir === 'string' ? dir.trim() : '';
  if (!resolved) return emptyDirMarkdownPage('');
  let names: string[] = [];
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    names = entries
      .filter((ent) => ent.isFile() && isMarkdownFileName(ent.name))
      .map((ent) => ent.name)
      .sort((a, b) => a.localeCompare(b, 'zh'));
  } catch {
    return emptyDirMarkdownPage(resolved, offset);
  }
  const page = paginateItems(names, offset, pageSize);
  return {
    dir: resolved,
    files: page.items.map((name) => ({ name, path: path.join(resolved, name) })),
    hasMore: page.hasMore,
    nextOffset: page.nextOffset,
  };
}
