/**
 * 从 Markdown 正文中提取「可能指向本地 .md」的 href（不含图片链接）。
 * 用于反向链接扫描（M64）与导出预检（M83）。
 */
import { fileURLToPath } from 'node:url';
import * as path from 'path';

/**
 * 抽取 `[]()` 内链（排除 `![]()`）、参考式 `[]: url`、以及 `[[wiki]]` 目标（转为相对路径名）。
 */
export function extractMarkdownLinkHrefs(markdown: string): string[] {
  const md = String(markdown ?? '');
  const out: string[] = [];

  const linkRe = /(^|[^!])\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/gm;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) {
    const href = (m[3] ?? '').trim();
    if (href) out.push(href);
  }

  const refDefRe = /^\[[^\]]+\]:\s*<?([^>\s]+)>?(?:\s+["'(].*)?$/gm;
  while ((m = refDefRe.exec(md)) !== null) {
    const href = (m[1] ?? '').trim();
    if (href) out.push(href);
  }

  const wikiRe = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  while ((m = wikiRe.exec(md)) !== null) {
    const name = (m[1] ?? '').trim();
    if (!name) continue;
    out.push(wikiPageNameToHref(name));
  }

  return out;
}

function wikiPageNameToHref(name: string): string {
  const t = name.trim();
  if (!t) return '';
  if (/\.[a-zA-Z0-9]{1,12}$/.test(t)) return t;
  return `${t}.md`;
}

export function pathsEqualFs(a: string, b: string): boolean {
  const na = path.normalize(a);
  const nb = path.normalize(b);
  if (process.platform === 'win32') {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}

/**
 * 将 markdown 中的 href 解析为本地文件系统绝对路径；无法解析或非本地则返回 null。
 */
export function resolveMarkdownHrefToFsPath(opts: {
  /** 含该链接的 .md 文件的绝对路径 */
  sourceFileFsPath: string;
  href: string;
  /** 工作区文件夹根绝对路径（用于以 `/` 开头的「根相对」链接） */
  workspaceRootFsPath: string;
}): string | null {
  const trimmed = String(opts.href ?? '').trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|data:)/i.test(trimmed)) return null;

  if (/^file:\/\//i.test(trimmed)) {
    try {
      return path.normalize(fileURLToPath(trimmed));
    } catch {
      return null;
    }
  }

  let pathPart = trimmed.split('#')[0]?.split('?')[0]?.trim() ?? '';
  if (!pathPart) return null;

  const root = opts.workspaceRootFsPath;

  // 以 / 开头：按工作区根目录解析（常见于知识库约定）
  if (pathPart.startsWith('/') && !pathPart.startsWith('//')) {
    return path.normalize(path.join(root, pathPart.slice(1)));
  }

  if (/^[a-zA-Z]:[\\/]/.test(pathPart) || pathPart.startsWith('\\\\')) {
    return path.normalize(pathPart);
  }

  const dir = path.dirname(opts.sourceFileFsPath);
  return path.normalize(path.resolve(dir, pathPart));
}
