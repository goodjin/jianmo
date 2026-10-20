/**
 * 保存结果在页面和主进程之间怎么读。
 * 这里不能引用文件系统，否则会被打进页面。
 */

export type SaveIpc =
  | { ok: true; path: string }
  | { ok: false; reason: 'cancelled' | 'failed' | 'reloaded' | 'no-tab'; message: string };

export function parseSaveResult(raw: unknown): SaveIpc {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'failed', message: '没有保存结果' };
  const rec = raw as { ok?: unknown; path?: unknown; reason?: unknown; message?: unknown };
  if (rec.ok === true && typeof rec.path === 'string') return { ok: true, path: rec.path };
  const reason =
    rec.reason === 'cancelled' || rec.reason === 'failed' || rec.reason === 'reloaded' || rec.reason === 'no-tab'
      ? rec.reason
      : 'failed';
  const message = typeof rec.message === 'string' ? rec.message : '';
  return { ok: false, reason, message };
}
