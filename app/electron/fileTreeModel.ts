/**
 * 目录树的纯数据：类型、IPC 载荷校验、路径关系。
 * 不碰 fs，renderer 与主进程都能引用。
 */

export interface FileTreeEntry {
  name: string;
  path: string;
  kind: 'dir' | 'file';
}

export interface FileTreeListResult {
  dir: string;
  entries: FileTreeEntry[];
  error: string;
}

export const FILE_TREE_ERR_NO_ROOT = '未选择文件夹';
export const FILE_TREE_ERR_OUTSIDE = '不能查看所选文件夹以外的路径';
export const FILE_TREE_ERR_UNREADABLE = '无法读取该文件夹';

function stripTrail(p: string): string {
  if (p.length <= 1) return p;
  const t = p.replace(/[/\\]+$/, '');
  // 盘符根 `C:\` 去掉分隔符就成了 `C:`（当前目录语义），保留根的写法
  if (/^[A-Za-z]:$/.test(t)) return p.slice(0, 3);
  return t || p;
}

function sepOf(p: string): string {
  return p.includes('\\') && !p.includes('/') ? '\\' : '/';
}

/** 根自身以分隔符结尾（`/`、`C:\`）时不再补分隔符。 */
function joinUnder(root: string, name: string): string {
  const sep = sepOf(root);
  return (root.endsWith(sep) ? root : root + sep) + name;
}

/** 候选路径等于根，或是根下面的路径。`/docs` 不包含 `/docs-other`。 */
export function isPathUnderRoot(root: string, candidate: string): boolean {
  const r = stripTrail(String(root ?? '').trim());
  const c = stripTrail(String(candidate ?? '').trim());
  if (!r || !c) return false;
  if (r === c) return true;
  return c.startsWith(joinUnder(r, ''));
}

/** 文件所在目录。根上的文件返回 `/` 或盘符根；无法再拆则返回空串。 */
export function parentDir(filePath: string): string {
  const trimmed = stripTrail(String(filePath ?? '').trim());
  if (!trimmed) return '';
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (idx < 0) return '';
  if (idx === 0) return sepOf(trimmed);
  const dir = trimmed.slice(0, idx);
  // `C:\a.md` 的目录是盘符根 `C:\`，不是「C: 当前目录」
  return /^[A-Za-z]:$/.test(dir) ? dir + sepOf(trimmed) : dir;
}

/**
 * 该路径所属的文件系统根：POSIX 返回 `/`，Windows 返回盘符根（`C:\`）。
 * 目录树从这里开始铺「完整文件夹树」，树根不再由用户挑选。
 */
export function filesystemRootOf(filePath: string): string {
  const trimmed = String(filePath ?? '').trim();
  if (!trimmed) return '';
  const win = trimmed.match(/^([A-Za-z]):[/\\]/);
  if (win) return `${win[1]!.toUpperCase()}:\\`;
  if (trimmed.startsWith('/')) return '/';
  return '';
}

/**
 * 从根到该文件之间要展开的目录（不含根、不含文件本身）。
 * 文件不在根下时返回空，避免把别的目录树撑开。
 */
export function ancestorDirs(root: string, filePath: string): string[] {
  const r = stripTrail(String(root ?? '').trim());
  const f = stripTrail(String(filePath ?? '').trim());
  if (!r || !f || r === f || !isPathUnderRoot(r, f)) return [];
  const parts = f
    .slice(r.length)
    .replace(/^[/\\]+/, '')
    .split(/[/\\]/)
    .filter(Boolean);
  if (parts.length <= 1) return [];
  const dirs: string[] = [];
  let acc = r;
  for (const part of parts.slice(0, -1)) {
    // 根自身以分隔符结尾（`/`、`C:\`）时不能再补一个
    acc = joinUnder(acc, part);
    dirs.push(acc);
  }
  return dirs;
}

/** 主进程回包是 unknown，进树之前丢掉缺名字、缺路径或 kind 不对的项。 */
export function parseFileTreeResult(raw: unknown): FileTreeListResult {
  if (!raw || typeof raw !== 'object') {
    return { dir: '', entries: [], error: FILE_TREE_ERR_UNREADABLE };
  }
  const obj = raw as Record<string, unknown>;
  const dir = typeof obj.dir === 'string' ? obj.dir : '';
  const error = typeof obj.error === 'string' ? obj.error : '';
  const entries: FileTreeEntry[] = [];
  if (Array.isArray(obj.entries)) {
    for (const item of obj.entries) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const name = typeof e.name === 'string' ? e.name.trim() : '';
      const entryPath = typeof e.path === 'string' ? e.path : '';
      const kind = e.kind === 'dir' || e.kind === 'file' ? e.kind : null;
      if (!name || !entryPath || !kind) continue;
      entries.push({ name, path: entryPath, kind });
    }
  }
  return { dir, entries, error };
}
