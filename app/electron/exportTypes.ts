/** 页面和主进程共用的导出格式，不依赖 Node 写文件。 */
export type AppExportFormat = 'pdf' | 'html';

export type ExportIpcSuccess = { ok: true; path: string; format: AppExportFormat };
export type ExportIpcCancelled = { ok: false; cancelled: true };
export type ExportIpcFailure = { ok: false; error: string };
export type ExportIpcResult = ExportIpcSuccess | ExportIpcCancelled | ExportIpcFailure;

export function isAppExportFormat(value: unknown): value is AppExportFormat {
  return value === 'pdf' || value === 'html';
}

export function parseExportResult(raw: unknown): ExportIpcResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '导出失败' };
  const obj = raw as Record<string, unknown>;
  if (obj.ok === true && typeof obj.path === 'string' && obj.path.length > 0) {
    return {
      ok: true,
      path: obj.path,
      format: obj.format === 'pdf' ? 'pdf' : 'html',
    };
  }
  if (obj.cancelled === true) return { ok: false, cancelled: true };
  const error = typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : '导出失败';
  return { ok: false, error };
}
