/**
 * M82：HTML 导出时将文档目录下的本地图片复制到输出 HTML 旁的资产目录，并重写 `<img src>`。
 */
import * as fs from 'fs';
import * as path from 'path';

/** 从 HTML 中提取所有 img 的 src（去重，保留原始字符串用于回写） */
export function extractImgSrcsFromHtml(html: string): string[] {
  const re = /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']*)\1/gi;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = String(m[2] ?? '').trim();
    if (src) found.push(src);
  }
  return [...new Set(found)];
}

export function isRemoteOrSpecialImgSrc(src: string): boolean {
  const s = String(src ?? '').trim();
  if (!s) return true;
  if (/^(https?:|data:|mailto:|\/\/)/i.test(s)) return true;
  if (s.startsWith('#')) return true;
  return false;
}

/** `abs` 规范化后须落在 `dir` 之下（防止 `..` 逃逸） */
export function isResolvedPathUnderDir(absPath: string, dirPath: string): boolean {
  const base = path.resolve(dirPath);
  const target = path.resolve(absPath);
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

export interface BundleHtmlLocalImagesResult {
  html: string;
  copiedFiles: string[];
  skipped: Array<{ src: string; reason: string }>;
}

/**
 * 将 HTML 中指向文档目录内的相对图片复制到 `dirname(outputHtmlPath)/assetsSubdirectory/...`，并重写 src 为相对 HTML 的路径。
 * 开始前会删除已存在的 `assetsSubdirectory` 目录以免残留旧文件。
 */
export function bundleHtmlLocalImages(options: {
  html: string;
  documentDir: string;
  outputHtmlPath: string;
  assetsSubdirectory: string;
}): BundleHtmlLocalImagesResult {
  const { html, outputHtmlPath } = options;
  const documentDir = path.resolve(options.documentDir);
  const outputDir = path.dirname(path.resolve(outputHtmlPath));
  const sub = sanitizeAssetsSubdirectory(options.assetsSubdirectory);
  const assetsRoot = path.join(outputDir, sub);

  const copiedFiles: string[] = [];
  const skipped: Array<{ src: string; reason: string }> = [];

  if (fs.existsSync(assetsRoot)) {
    fs.rmSync(assetsRoot, { recursive: true, force: true });
  }

  const srcs = extractImgSrcsFromHtml(html).filter((s) => !isRemoteOrSpecialImgSrc(s));
  const replacement = new Map<string, string>();

  for (const rawSrc of srcs) {
    if (replacement.has(rawSrc)) continue;

    let decoded = rawSrc;
    try {
      decoded = decodeURIComponent(rawSrc);
    } catch {
      decoded = rawSrc;
    }

    const abs = path.normalize(path.join(documentDir, decoded));
    if (!isResolvedPathUnderDir(abs, documentDir)) {
      skipped.push({ src: rawSrc, reason: 'outside_document_dir' });
      continue;
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      skipped.push({ src: rawSrc, reason: 'not_found' });
      continue;
    }

    const relFromDoc = path.relative(documentDir, abs);
    const destAbs = path.join(assetsRoot, relFromDoc);
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(abs, destAbs);
    copiedFiles.push(destAbs);

    const relUrl = `./${path.join(sub, relFromDoc).split(path.sep).join('/')}`;
    replacement.set(rawSrc, relUrl);
  }

  let out = html;
  for (const [oldSrc, newUrl] of [...replacement.entries()].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(`src="${oldSrc}"`).join(`src="${newUrl}"`);
    out = out.split(`src='${oldSrc}'`).join(`src='${newUrl}'`);
  }

  return { html: out, copiedFiles, skipped };
}

export function sanitizeAssetsSubdirectory(name: string): string {
  const raw = String(name ?? '').trim() || 'markly-html-assets';
  if (raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    return 'markly-html-assets';
  }
  const base = path.basename(raw);
  if (!base || base === '.' || base === '..') return 'markly-html-assets';
  return base;
}
