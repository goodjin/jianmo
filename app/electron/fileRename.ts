/**
 * 文件重命名的纯判断：不碰 fs、不碰 electron。
 * 磁盘上有没有同名文件、改名是否成功，由调用方交进来。
 */

import { parentDir } from './fileTreeModel';
import { displayNameFromPath } from '../renderer/documentMeta';

export interface RenamePlanOk {
  ok: true;
  from: string;
  to: string;
  unchanged: boolean;
}

export interface RenamePlanErr {
  ok: false;
  error: string;
}

export type RenamePlan = RenamePlanOk | RenamePlanErr;

export interface RenameApplyDeps {
  /** 目标路径已经有别的文件时返回 true。同一个文件只是大小写不同时应返回 false。 */
  taken: (dest: string) => boolean;
  isFile: (path: string) => boolean;
  rename: (from: string, to: string) => void;
}

function pathSep(filePath: string): string {
  return filePath.includes('\\') && !filePath.includes('/') ? '\\' : '/';
}

function joinParent(parent: string, name: string, sep: string): string {
  return parent.endsWith(sep) ? parent + name : parent + sep + name;
}

/**
 * 目标算不算「被占用」。
 * 不存在则没占用；存在且和源文件是同一个（不区分大小写的磁盘上改大小写）也不算占用。
 */
export function destinationTaken(
  from: string,
  dest: string,
  exists: (path: string) => boolean,
  sameFile: (a: string, b: string) => boolean
): boolean {
  if (dest === from) return false;
  let present = false;
  try {
    present = exists(dest);
  } catch {
    return true;
  }
  if (!present) return false;
  try {
    return !sameFile(from, dest);
  } catch {
    return true;
  }
}

/** 只检查名字。同名视为不改；斜杠、空名、`.` / `..` 拒绝。 */
export function planRename(fromPath: string, nextName: string, taken: (dest: string) => boolean): RenamePlan {
  const from = String(fromPath ?? '').trim();
  const name = String(nextName ?? '').trim();
  if (!from) return { ok: false, error: '找不到原文件' };
  if (!name || name === '.' || name === '..') return { ok: false, error: '文件名无效' };
  if (/[/\\]/.test(name)) return { ok: false, error: '文件名不能包含斜杠' };

  const parent = parentDir(from);
  if (!parent) return { ok: false, error: '找不到所在文件夹' };

  const current = displayNameFromPath(from).fileName;
  const to = joinParent(parent, name, pathSep(from));
  if (name === current || to === from) return { ok: true, from, to: from, unchanged: true };
  if (taken(to)) return { ok: false, error: '已有同名文件' };
  return { ok: true, from, to, unchanged: false };
}

/** 先计划，再改名。计划失败或磁盘失败时不会假装成功。 */
export function applyFileRename(fromPath: string, nextName: string, deps: RenameApplyDeps): RenamePlan {
  const plan = planRename(fromPath, nextName, deps.taken);
  if (!plan.ok || plan.unchanged) return plan;
  let file = false;
  try {
    file = deps.isFile(plan.from);
  } catch {
    file = false;
  }
  if (!file) return { ok: false, error: '找不到原文件' };
  try {
    deps.rename(plan.from, plan.to);
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : '';
    return { ok: false, error: message || '重命名失败' };
  }
  return plan;
}

export interface RenameIpcResult {
  ok: boolean;
  path: string;
  error: string;
}

/** 主进程回包是 unknown。失败时一定带一句能显示的说明。 */
export function parseRenameResult(raw: unknown): RenameIpcResult {
  if (!raw || typeof raw !== 'object') return { ok: false, path: '', error: '重命名失败' };
  const obj = raw as Record<string, unknown>;
  const ok = obj.ok === true;
  const path = typeof obj.path === 'string' ? obj.path : '';
  const error = typeof obj.error === 'string' ? obj.error.trim() : '';
  return { ok, path, error: ok ? '' : error || '重命名失败' };
}
