/**
 * macOS 会保护用户主目录下的「文稿 / 桌面 / 下载」。
 * 安装包若没在 Info.plist 里声明用途，系统不抛错误，而是直接杀掉进程。
 * 这里只负责：认路径、以及用户拒绝授权后给出能看懂的说明。
 */
import { FILE_TREE_ERR_UNREADABLE } from './fileTreeModel';

const PROTECTED_FOLDERS: Record<string, string> = {
  Documents: '文稿',
  Desktop: '桌面',
  Downloads: '下载',
};

function pathParts(filePath: string): string[] {
  return String(filePath ?? '')
    .split(/[/\\]/)
    .filter((part) => part.length > 0);
}

/** 路径落在用户主目录的文稿、桌面或下载里时，返回访达里的中文名。 */
export function macProtectedFolderLabel(filePath: string): string | null {
  const parts = pathParts(filePath);
  const folderIdx = parts.findIndex((part) => Object.prototype.hasOwnProperty.call(PROTECTED_FOLDERS, part));
  // 必须是 …/Users/<名字>/Documents 这一层，避免把项目里名叫 Documents 的目录算进去。
  if (folderIdx < 2) return null;
  const scope = parts[folderIdx - 2];
  if (scope !== 'Users' && scope !== 'home') return null;
  return PROTECTED_FOLDERS[parts[folderIdx]] ?? null;
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

export function isFolderAccessDenied(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'EPERM' || code === 'EACCES';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return '无法读取';
}

/** 拒绝访问受保护目录时，告诉用户去系统设置里允许；其它错误保留原来的说明。 */
export function readFailureDetail(filePath: string, error: unknown): string {
  const label = macProtectedFolderLabel(filePath);
  if (isFolderAccessDenied(error) && label) {
    return `系统不允许读取「${label}」。请到「系统设置 → 隐私与安全性 → 文件和文件夹」允许 Markly。`;
  }
  return errorMessage(error);
}

/** 目录树读失败：受保护目录被拒绝时说明原因，其余仍用原来的短句。 */
export function folderListError(dir: string, error: unknown): string {
  if (isFolderAccessDenied(error) && macProtectedFolderLabel(dir)) return readFailureDetail(dir, error);
  return FILE_TREE_ERR_UNREADABLE;
}
