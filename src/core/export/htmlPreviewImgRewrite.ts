/**
 * M88：导出 HTML 预览 — 将文档目录下的相对 `<img src>` 改写为可由宿主注入的可加载 URL。
 */
import * as fs from 'fs';
import * as path from 'path';
import { isRemoteOrSpecialImgSrc, isResolvedPathUnderDir } from './htmlBundleImages';

export function rewriteLocalImgSrcForPreview(
  html: string,
  documentDir: string,
  toPreviewUrl: (resolvedAbsolutePath: string) => string
): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
    if (!m) return tag;
    const q = m[1];
    const src = String(m[2] ?? '').trim();
    if (!src || isRemoteOrSpecialImgSrc(src)) return tag;

    const resolved = path.isAbsolute(src) ? path.normalize(src) : path.normalize(path.join(documentDir, src));
    if (!fs.existsSync(resolved)) return tag;
    if (!isResolvedPathUnderDir(resolved, documentDir)) return tag;
    try {
      const url = toPreviewUrl(resolved);
      return tag.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/i, `src=${q}${url}${q}`);
    } catch {
      return tag;
    }
  });
}
