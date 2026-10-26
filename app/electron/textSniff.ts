/**
 * 打开前看一小段字节，拦住二进制。
 * 不读整份文件。Publisher 的 .pub、图片、压缩包即使扩展名像文本也不开。
 */
import { fileExtension } from './documentKind';

export const TEXT_SNIFF_BYTES = 8192;

/** 拖进来时按扩展名直接略过，不必再读。密钥的 .key 不在这里。 */
const BINARY_EXTENSIONS = [
  '7z',
  'aac',
  'aif',
  'aiff',
  'ai',
  'avi',
  'bin',
  'bmp',
  'bz2',
  'class',
  'db',
  'dll',
  'dmg',
  'doc',
  'docx',
  'dylib',
  'eot',
  'exe',
  'fig',
  'flac',
  'flv',
  'gif',
  'gz',
  'heic',
  'heif',
  'icns',
  'ico',
  'iso',
  'jar',
  'jpeg',
  'jpg',
  'keynote',
  'm4a',
  'm4v',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'numbers',
  'ogg',
  'otf',
  'pages',
  'pdf',
  'pkg',
  'png',
  'ppt',
  'pptx',
  'psd',
  'rar',
  'sketch',
  'so',
  'sqlite',
  'sqlite3',
  'tar',
  'tgz',
  'tif',
  'tiff',
  'ttf',
  'war',
  'wasm',
  'wav',
  'webm',
  'webp',
  'woff',
  'woff2',
  'xls',
  'xlsx',
  'xz',
  'zip',
] as const;

const BINARY_EXTENSION_SET = new Set<string>(BINARY_EXTENSIONS);

const BINARY_MAGICS: number[][] = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
  [0x1f, 0x8b], // gzip
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O
  [0xfe, 0xed, 0xfa, 0xcf],
  [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe],
  [0xd0, 0xcf, 0x11, 0xe0], // OLE，含 Microsoft Publisher
  [0x42, 0x5a, 0x68], // bzip2
  [0x52, 0x49, 0x46, 0x46], // RIFF：wav / avi / webp
  [0x42, 0x4d], // BMP
  [0x4d, 0x5a], // MZ
  [0x62, 0x70, 0x6c, 0x69, 0x73, 0x74], // bplist
  [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], // SQLite
  [0x4f, 0x67, 0x67, 0x53], // Ogg
  [0x66, 0x4c, 0x61, 0x43], // fLaC
  [0x49, 0x44, 0x33], // ID3
  [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], // 7z
  [0x52, 0x61, 0x72, 0x21], // Rar!
  [0x77, 0x4f, 0x46, 0x46], // WOFF
  [0x77, 0x4f, 0x46, 0x32], // WOFF2
  [0x4f, 0x54, 0x54, 0x4f], // OTTO
];

function startsWithBytes(sample: Buffer, bytes: number[]): boolean {
  if (sample.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (sample[i] !== bytes[i]) return false;
  }
  return true;
}

function hasBinaryMagic(sample: Buffer): boolean {
  if (BINARY_MAGICS.some((magic) => startsWithBytes(sample, magic))) return true;
  // MP4 / MOV：第 4 字节起是 ftyp
  return (
    sample.length >= 8 &&
    sample[4] === 0x66 &&
    sample[5] === 0x74 &&
    sample[6] === 0x79 &&
    sample[7] === 0x70
  );
}

export function isKnownBinaryName(name: string): boolean {
  const ext = fileExtension(name);
  return ext !== '' && BINARY_EXTENSION_SET.has(ext);
}

/** 空文件当文本。有空字节、UTF-16 头或常见二进制文件头则不是。 */
export function bufferLooksLikeText(sample: Buffer): boolean {
  if (sample.includes(0)) return false;
  if (sample.length >= 2) {
    const utf16Le = sample[0] === 0xff && sample[1] === 0xfe;
    const utf16Be = sample[0] === 0xfe && sample[1] === 0xff;
    if (utf16Le || utf16Be) return false;
  }
  return !hasBinaryMagic(sample);
}

/**
 * 字节像文本才打开。已知的图片、压缩包、可执行文件即使开头碰巧没有空字节也不开。
 * 没登记过的扩展名，只要字节像文本，也打开（拖进来或在「所有文件」里选中）。
 */
export function shouldOpenTextDocument(name: string, sample: Buffer): boolean {
  if (isKnownBinaryName(name)) return false;
  return bufferLooksLikeText(sample);
}
