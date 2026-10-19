/**
 * 重新加载的结果。页面和主进程都能用，不读磁盘。
 * 读失败时正文必须留着，不能换成空字符串或错误页。
 */

export const RELOAD_OK_TIP = '已重新加载';
export const RELOAD_MISSING_TIP = '这个文件已经不在了，仍显示上次的内容';
export const RELOAD_UNREADABLE_TIP = '没能重新读取，仍显示上次的内容';
/** 成功提示多久后自己收起。失败提示留着，直到下次刷新替换它。 */
export const RELOAD_TIP_OK_MS = 2000;

export type ReloadFailure = 'no-file' | 'missing' | 'unreadable';

export type ReloadRead =
  | { ok: true; content: string }
  | { ok: false; reason: ReloadFailure };

export type ReloadIpc = { ok: true } | { ok: false; reason: ReloadFailure };

/** 只有读成功才换成新正文。其余情况原样返回。 */
export function contentAfterReload(previous: string, result: ReloadRead): string {
  if (result.ok) return result.content;
  return previous;
}

export function parseReloadResult(raw: unknown): ReloadIpc {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'unreadable' };
  const rec = raw as { ok?: unknown; reason?: unknown };
  if (rec.ok === true) return { ok: true };
  if (rec.reason === 'no-file' || rec.reason === 'missing' || rec.reason === 'unreadable') {
    return { ok: false, reason: rec.reason };
  }
  return { ok: false, reason: 'unreadable' };
}
