/**
 * Markdown 本地图片引用：纯路径解析（无 VS Code API），供导出预检与宿主解析共用。
 */
import * as path from 'path';

/** 与 `imagePaths.isLocalMarkdownImageRef` 对齐：排除绝对根路径 `/`（由工作区根单独解析） */
export function isLocalMarkdownImageRef(src: string): boolean {
  const value = String(src ?? '').trim();
  return !!value && !/^(https?:|data:|file:)/i.test(value) && !value.startsWith('/');
}

/** 从 Markdown 正文中收集 `![](...)` 的 src（含相对路径），用于导出前校验。 */
export function extractMarkdownLocalImageRefs(markdown: string): string[] {
  const out: string[] = [];
  const re = /!\[[^\]]*\]\(\s*([^)\s]+)\s*(?:\s+"[^"]*")?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const raw = String(m[1] ?? '').trim();
    if (!raw) continue;
    const src = raw.split(/[?#]/)[0] ?? raw;
    if (!src || /^(https?:|data:|file:)/i.test(src)) continue;
    out.push(src);
  }
  return out;
}

/**
 * 将相对/相对当前文档的图片引用解析为绝对 fs 路径；无法解析或非本地则返回 null。
 */
export function resolveMarkdownImageFsPath(documentFsPath: string, ref: string): string | null {
  if (!isLocalMarkdownImageRef(ref)) return null;
  const clean = String(ref).trim().split(/[?#]/)[0]?.trim() ?? '';
  if (!clean) return null;
  const dir = path.dirname(documentFsPath);
  return path.normalize(path.resolve(dir, clean));
}
