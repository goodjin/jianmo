import { canonicalMarkdownLocalRefKey } from './markdownLocalRefCanonical';

export interface MarkdownImageRef {
  alt: string;
  src: string;
  isLocal: boolean;
}

export interface ImageDiagnostics {
  totalRefs: number;
  localRefs: number;
  remoteRefs: number;
  saveDirectory: string | null;
  renderedImages: number;
  sampleRefs: MarkdownImageRef[];
  localRefSamples: string[];
  checkedLocalRefs: number;
  existingRefs: Array<{ ref: string; resolvedPath?: string }>;
  missingRefs: Array<{ ref: string; resolvedPath?: string; error?: string }>;
  lastCheckedAt: string | null;
  compression: {
    threshold: number | null;
    quality: number | null;
  };
  /** M55：最近一次列出保存目录一层图片后的条目数；未列出过则为 null */
  assetDirectoryListedCount: number | null;
  /** M55：保存目录一层内相对文档的路径，在正文（图片 + 常用 Markdown 路径形态）未见引用 */
  unreferencedAssetRelativePaths: string[] | null;
}

export function isLocalImageRef(src: string): boolean {
  const value = String(src ?? '').trim();
  return !!value && !/^(https?:|data:|file:)/i.test(value) && !value.startsWith('/');
}

export function parseMarkdownImageRefs(markdown: string): MarkdownImageRef[] {
  return Array.from(String(markdown ?? '').matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)).map((m) => {
    const src = m[2] ?? '';
    return {
      alt: m[1] ?? '',
      src,
      isLocal: isLocalImageRef(src),
    };
  });
}

function collectReferencedLocalRefKeys(markdown: string): Set<string> {
  const keys = new Set<string>();
  const md = String(markdown ?? '');
  for (const row of parseMarkdownImageRefs(md)) {
    if (!row.isLocal) continue;
    keys.add(canonicalMarkdownLocalRefKey(row.src));
  }
  const linkRe = /(^|[^!])\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gm;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) {
    const url = m[3] ?? '';
    if (!url || !isLocalImageRef(url)) continue;
    keys.add(canonicalMarkdownLocalRefKey(url));
  }
  const refDefRe = /^\[[^\]]+\]:\s*<?([^>\s]+)>?/gm;
  while ((m = refDefRe.exec(md)) !== null) {
    const url = m[1] ?? '';
    if (!url || !isLocalImageRef(url)) continue;
    keys.add(canonicalMarkdownLocalRefKey(url));
  }
  return keys;
}

/** M55：保存目录列出的 posix 路径中，在当前 Markdown 正文中未发现引用的条目（已去重排序） */
export function computeUnreferencedAssetImages(markdown: string, assetRelativePaths: readonly string[]): string[] {
  const keys = collectReferencedLocalRefKeys(markdown);
  const uniq = Array.from(new Set(assetRelativePaths));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq.filter((p) => !keys.has(canonicalMarkdownLocalRefKey(p)));
}

export function buildImageDiagnostics(args: {
  markdown: string;
  renderedImages: string[];
  saveDirectory?: string | null;
  compressThreshold?: number | null;
  compressQuality?: number | null;
  localCheckResults?: Array<{ ref: string; exists: boolean; resolvedPath?: string; error?: string }>;
  lastCheckedAt?: string | null;
  /** M55：已列出的文档相对路径；省略则表示尚未列出保存目录，诊断中不出现未引用字段 */
  assetRelativeDirectoryImagePaths?: string[];
}): ImageDiagnostics {
  const refs = parseMarkdownImageRefs(args.markdown);
  const localRefs = refs.filter((ref) => ref.isLocal);
  const localCheckResults = args.localCheckResults ?? [];
  const assetPathsArg = args.assetRelativeDirectoryImagePaths;
  const hasAssetScan = assetPathsArg !== undefined;

  return {
    totalRefs: refs.length,
    localRefs: localRefs.length,
    remoteRefs: refs.length - localRefs.length,
    saveDirectory: args.saveDirectory ?? null,
    renderedImages: args.renderedImages.length,
    sampleRefs: refs.slice(0, 10),
    localRefSamples: localRefs.map((ref) => ref.src).slice(0, 10),
    checkedLocalRefs: localCheckResults.length,
    existingRefs: localCheckResults
      .filter((result) => result.exists)
      .map((result) => ({ ref: result.ref, resolvedPath: result.resolvedPath }))
      .slice(0, 20),
    missingRefs: localCheckResults
      .filter((result) => !result.exists)
      .map((result) => ({ ref: result.ref, resolvedPath: result.resolvedPath, error: result.error }))
      .slice(0, 20),
    lastCheckedAt: args.lastCheckedAt ?? null,
    compression: {
      threshold: args.compressThreshold ?? null,
      quality: args.compressQuality ?? null,
    },
    assetDirectoryListedCount: hasAssetScan ? assetPathsArg.length : null,
    unreferencedAssetRelativePaths: hasAssetScan ? computeUnreferencedAssetImages(args.markdown, assetPathsArg) : null,
  };
}

export function formatMissingImageRefsList(
  missingRefs: Array<{ ref: string; resolvedPath?: string; error?: string }>
): string {
  if (!missingRefs.length) return '未发现缺失的本地图片。';
  const lines = ['缺失图片引用清单', '', '| 引用 | 解析路径 | 错误 |', '| --- | --- | --- |'];
  for (const item of missingRefs) {
    lines.push(`| ${escapeTableCell(item.ref)} | ${escapeTableCell(item.resolvedPath ?? '')} | ${escapeTableCell(item.error ?? '')} |`);
  }
  return lines.join('\n');
}

export function formatUnreferencedAssetImagesList(paths: string[]): string {
  if (!paths.length) return '未发现未引用图片（请先确认保存目录可访问并已列出）。';
  return ['保存目录一层内 · 正文未引用图片清单（相对文档路径）', '', ...paths.map((p) => `- ${p}`)].join('\n');
}

export function replaceMarkdownImageRef(markdown: string, fromRef: string, toRef: string): string {
  return String(markdown ?? '').replace(
    /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (match, alt, src, title) => {
      if (src !== fromRef) return match;
      return `![${alt}](${toRef}${title ?? ''})`;
    }
  );
}

export function normalizeLocalImageRefsToDirectory(markdown: string, saveDirectory: string): string {
  const normalizedDir = String(saveDirectory || './assets').trim().replace(/\/+$/, '') || './assets';
  return String(markdown ?? '').replace(
    /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (match, alt, src, title) => {
      if (!isLocalImageRef(src)) return match;
      const clean = src.split(/[?#]/)[0] ?? '';
      const filename = clean.split('/').filter(Boolean).pop();
      if (!filename) return match;
      return `![${alt}](${normalizedDir}/${filename}${title ?? ''})`;
    }
  );
}

function escapeTableCell(value: string): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

