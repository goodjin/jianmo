/**
 * iframe srcdoc 无法解析相对路径图片；把文档目录内本地图片内联为 data URL。
 * 仅改写落在 documentDir 之下的文件，防止 `..` 逃逸。
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  extractImgSrcsFromHtml,
  isRemoteOrSpecialImgSrc,
  isResolvedPathUnderDir,
} from '../../src/core/export/htmlBundleImages';

export const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
};

export function mimeFromExt(ext: string): string {
  return MIME_BY_EXT[String(ext ?? '').toLowerCase()] ?? 'application/octet-stream';
}

function decodeSrc(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}

/** 读盘失败、超大小、非文件 → null（调用方保留原 src）。 */
export function fileToDataUrl(absPath: string): string | null {
  try {
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;
    const buf = fs.readFileSync(absPath);
    if (buf.length > MAX_INLINE_IMAGE_BYTES) return null;
    return `data:${mimeFromExt(path.extname(absPath))};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function inlineLocalPreviewImages(html: string, documentDir: string): string {
  if (!html || !documentDir || !fs.existsSync(documentDir)) return html;
  const srcs = extractImgSrcsFromHtml(html).filter((s) => !isRemoteOrSpecialImgSrc(s));
  let out = html;
  for (const rawSrc of srcs) {
    const decoded = decodeSrc(rawSrc);
    if (/^file:/i.test(decoded)) continue;
    const abs = path.isAbsolute(decoded)
      ? path.normalize(decoded)
      : path.normalize(path.join(documentDir, decoded));
    if (!isResolvedPathUnderDir(abs, documentDir)) continue;
    const dataUrl = fileToDataUrl(abs);
    if (!dataUrl) continue;
    out = out.split(`src="${rawSrc}"`).join(`src="${dataUrl}"`);
    out = out.split(`src='${rawSrc}'`).join(`src='${dataUrl}'`);
  }
  return out;
}
