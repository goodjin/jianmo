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
  compression: {
    threshold: number | null;
    quality: number | null;
  };
}

export function isLocalImageRef(src: string): boolean {
  const value = String(src ?? '').trim();
  return !!value && !/^(https?:|data:|file:)/i.test(value);
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
}): ImageDiagnostics {
  const refs = parseMarkdownImageRefs(args.markdown);
  const localRefs = refs.filter((ref) => ref.isLocal);
  return {
    totalRefs: refs.length,
    localRefs: localRefs.length,
    remoteRefs: refs.length - localRefs.length,
    saveDirectory: args.saveDirectory ?? null,
    renderedImages: args.renderedImages.length,
    sampleRefs: refs.slice(0, 10),
    localRefSamples: localRefs.map((ref) => ref.src).slice(0, 10),
    compression: {
      threshold: args.compressThreshold ?? null,
      quality: args.compressQuality ?? null,
    },
  };
}

