/**
 * 按路径重新读一份已打开的文档。不改界面、不改标签里的旧正文。
 * 文件不在时返回 missing，调用方必须继续显示上次的内容。
 */
import * as fs from 'fs';
import type { ReloadRead } from './reloadResult';

function errno(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

export function readDocumentForReload(filePath: string): ReloadRead {
  const p = String(filePath ?? '').trim();
  if (!p) return { ok: false, reason: 'no-file' };

  try {
    if (!fs.statSync(p).isFile()) {
      console.warn('[markly] 重新加载的路径不是文件', { file: p });
      return { ok: false, reason: 'unreadable' };
    }
  } catch (err) {
    if (errno(err) === 'ENOENT') return { ok: false, reason: 'missing' };
    console.warn('[markly] 重新加载时无法查看文件', { file: p, code: errno(err) });
    return { ok: false, reason: 'unreadable' };
  }

  try {
    return { ok: true, content: fs.readFileSync(p, 'utf8') };
  } catch (err) {
    if (errno(err) === 'ENOENT') return { ok: false, reason: 'missing' };
    console.warn('[markly] 重新加载读取失败', { file: p, code: errno(err) });
    return { ok: false, reason: 'unreadable' };
  }
}
