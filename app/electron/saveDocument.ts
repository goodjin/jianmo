/**
 * 把编辑器里的原文写回磁盘。
 * 先看磁盘是不是还和上次保存的一样；被人改过就不覆盖。
 * 写入先落到旁边的临时文件，成功再换名，避免留下半截。
 */
import * as fs from 'fs';
import * as path from 'path';

export { parseSaveResult, type SaveIpc } from './saveResult';

export interface DiskSnapshot {
  exists: boolean;
  mtimeMs: number | null;
  content: string | null;
}

export type SavePlan =
  | { action: 'write' }
  | { action: 'conflict'; reason: 'changed' | 'missing' };

export function planSave(args: {
  /** 打开或上次保存时的修改时间。null 表示这条路径还没和磁盘对过账。 */
  expectedMtimeMs: number | null;
  savedContent: string;
  disk: DiskSnapshot;
  /** 用户已在「另存为」里确认覆盖。 */
  force?: boolean;
}): SavePlan {
  if (args.force) return { action: 'write' };
  if (!args.disk.exists) {
    if (args.expectedMtimeMs === null) return { action: 'write' };
    return { action: 'conflict', reason: 'missing' };
  }
  if (args.disk.content === args.savedContent) return { action: 'write' };
  return { action: 'conflict', reason: 'changed' };
}

export function readDiskSnapshot(filePath: string): DiskSnapshot {
  const target = String(filePath ?? '').trim();
  if (!target) return { exists: false, mtimeMs: null, content: null };
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) return { exists: false, mtimeMs: null, content: null };
    return {
      exists: true,
      mtimeMs: stat.mtimeMs,
      content: fs.readFileSync(target, 'utf8'),
    };
  } catch (err) {
    const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : '';
    if (code === 'ENOENT') return { exists: false, mtimeMs: null, content: null };
    console.warn('[markly] 保存前无法查看文件', { file: target, code });
    return { exists: false, mtimeMs: null, content: null };
  }
}

export type WriteResult = { ok: true; mtimeMs: number } | { ok: false; error: string };

/** 临时文件写完再换名。失败时原来的文件还在。 */
export function writeFileAtomic(filePath: string, content: string): WriteResult {
  const target = String(filePath ?? '').trim();
  if (!target) return { ok: false, error: '没有文件路径' };
  const dir = path.dirname(target);
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now().toString(36)}.markly-tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, target);
    return { ok: true, mtimeMs: fs.statSync(target).mtimeMs };
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* 临时文件可能还没写出来 */
    }
    const message = err instanceof Error ? err.message.trim() : '';
    console.warn('[markly] 写入失败', { file: target, error: message });
    return { ok: false, error: message || '无法写入文件' };
  }
}
