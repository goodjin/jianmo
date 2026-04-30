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

export function buildImageDiagnostics(args: {
  markdown: string;
  renderedImages: string[];
  saveDirectory?: string | null;
  compressThreshold?: number | null;
  compressQuality?: number | null;
  localCheckResults?: Array<{ ref: string; exists: boolean; resolvedPath?: string; error?: string }>;
  lastCheckedAt?: string | null;
}): ImageDiagnostics {
  const refs = parseMarkdownImageRefs(args.markdown);
  const localRefs = refs.filter((ref) => ref.isLocal);
  const localCheckResults = args.localCheckResults ?? [];
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

