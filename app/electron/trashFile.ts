/**
 * 把文件移到废纸篓之前的判断，以及主进程结果的形状。
 * 真正移走文件由系统废纸篓完成，这里不碰磁盘。
 */

export interface TrashOk {
  ok: true;
  path: string;
  error: '';
}

export interface TrashErr {
  ok: false;
  path: string;
  error: string;
}

export type TrashResult = TrashOk | TrashErr;

/** 只接受还在磁盘上的文件。文件夹和已经不在的路径都不删。 */
export function planTrash(filePath: string, isFile: (path: string) => boolean): TrashResult {
  const target = String(filePath ?? '').trim();
  if (!target) return { ok: false, path: '', error: '没有要删除的文件' };
  try {
    if (!isFile(target)) return { ok: false, path: target, error: '文件已经不在了' };
  } catch {
    return { ok: false, path: target, error: '文件已经不在了' };
  }
  return { ok: true, path: target, error: '' };
}

export function parseTrashResult(raw: unknown): TrashResult {
  const obj = raw && typeof raw === 'object' ? (raw as { ok?: unknown; path?: unknown; error?: unknown }) : {};
  const filePath = typeof obj.path === 'string' ? obj.path : '';
  if (obj.ok === true) return { ok: true, path: filePath, error: '' };
  const error = typeof obj.error === 'string' ? obj.error.trim() : '';
  return { ok: false, path: filePath, error: error || '无法移到废纸篓' };
}
