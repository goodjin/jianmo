/**
 * 列出目录树的一层：子文件夹 + Markdown 文件。
 * 只允许落在用户选定根目录之内；符号链接整项跳过，避免指到根外面。
 */
import * as fs from 'fs';
import * as path from 'path';
import { isMarkdownFileName } from './recentFiles';
import {
  FILE_TREE_ERR_NO_ROOT,
  FILE_TREE_ERR_OUTSIDE,
  FILE_TREE_ERR_UNREADABLE,
  type FileTreeEntry,
  type FileTreeListResult,
} from './fileTreeModel';

export type { FileTreeEntry, FileTreeListResult };
export { FILE_TREE_ERR_NO_ROOT, FILE_TREE_ERR_OUTSIDE, FILE_TREE_ERR_UNREADABLE };

function realpathOrNull(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function lexicalInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** `/var` 与 realpath 后的 `/private/var` 不是同一串，不能直接 startsWith。 */
function samePrefix(root: string, candidate: string): boolean {
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return candidate === root || candidate.startsWith(prefix);
}

function locate(candidate: string, root: string): 'inside' | 'outside' | 'missing' {
  const rootAbs = path.resolve(root);
  const candAbs = path.resolve(candidate);
  const rootReal = realpathOrNull(rootAbs);
  if (!rootReal) return 'missing';
  const candReal = realpathOrNull(candAbs);
  if (candReal) return lexicalInside(rootReal, candReal) ? 'inside' : 'outside';
  // 还不存在的路径没有 realpath。先沿根目录的符号链接改写，再做词法判断。
  const rest = candAbs.slice(rootAbs.length).replace(/^[/\\]+/, '');
  const rewritten = samePrefix(rootAbs, candAbs) ? path.join(rootReal, rest) : candAbs;
  return lexicalInside(rootReal, rewritten) ? 'missing' : 'outside';
}

function byName(a: FileTreeEntry, b: FileTreeEntry): number {
  return a.name.localeCompare(b.name, 'zh', { numeric: true, sensitivity: 'base' });
}

/** 只列 `dir` 的直接子项。`dir` 省略时列根目录本身。越界或读不了都不抛。 */
export function listFileTree(dir: string, root: string): FileTreeListResult {
  const rootTrim = typeof root === 'string' ? root.trim() : '';
  if (!rootTrim) return { dir: '', entries: [], error: FILE_TREE_ERR_NO_ROOT };

  const rootAbs = path.resolve(rootTrim);
  const dirTrim = typeof dir === 'string' ? dir.trim() : '';
  const dirAbs = path.resolve(dirTrim || rootAbs);
  const where = locate(dirAbs, rootAbs);
  if (where === 'outside') return { dir: dirAbs, entries: [], error: FILE_TREE_ERR_OUTSIDE };
  if (where === 'missing') return { dir: dirAbs, entries: [], error: FILE_TREE_ERR_UNREADABLE };

  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return { dir: dirAbs, entries: [], error: FILE_TREE_ERR_UNREADABLE };
  }

  const dirs: FileTreeEntry[] = [];
  const files: FileTreeEntry[] = [];
  for (const ent of dirents) {
    if (!ent.name || ent.name.startsWith('.')) continue;
    if (ent.name.toLowerCase() === 'node_modules') continue;
    // 符号链接的真实位置可能在根外；目录树不跟着走。
    if (ent.isSymbolicLink()) continue;
    const full = path.join(dirAbs, ent.name);
    if (locate(full, rootAbs) !== 'inside') continue;
    if (ent.isDirectory()) {
      dirs.push({ name: ent.name, path: full, kind: 'dir' });
    } else if (ent.isFile() && isMarkdownFileName(ent.name)) {
      files.push({ name: ent.name, path: full, kind: 'file' });
    }
  }
  dirs.sort(byName);
  files.sort(byName);
  return { dir: dirAbs, entries: [...dirs, ...files], error: '' };
}
