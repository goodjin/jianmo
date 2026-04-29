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

