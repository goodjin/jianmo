/**
 * 把打进应用的思源黑体读出来，嵌进预览 HTML。
 * 预览在沙箱 iframe 里，读不到应用目录下的字体文件，所以用 data URI。
 * 界面按钮和文件树不走这里。
 */

import * as fs from 'fs';
import * as path from 'path';
import { readingFontForPreview } from './appearance';
import type { PreviewFontOptions } from './previewTheme';

const FONT_FILES = [
  { file: 'NotoSansSC-Regular.woff2', weight: 400 },
  { file: 'NotoSansSC-Bold.woff2', weight: 700 },
] as const;

let cachedFace: string | null = null;

function fontPath(file: string): string | null {
  const candidates = [
    path.join(__dirname, '../fonts', file),
    path.join(__dirname, '../../../fonts', file),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** 读到字体文件的字节。找不到时抛错，避免静默退回另一套字。 */
export function readBundledFont(file: string): Buffer {
  const found = fontPath(file);
  if (!found) throw new Error(`缺少正文字体 ${file}`);
  return fs.readFileSync(found);
}

export function bundledReadingFontFaceCss(): string {
  if (cachedFace) return cachedFace;
  cachedFace = FONT_FILES.map(({ file, weight }) => {
    const b64 = readBundledFont(file).toString('base64');
    return `@font-face{font-family:'Noto Sans SC';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
  return cachedFace;
}

/** 设置里存的值 → 预览样式要用的字体栈，以及要不要带上字体文件。 */
export function previewFontOptions(stored: unknown, fontSize?: number): PreviewFontOptions {
  const reading = readingFontForPreview(stored);
  return {
    fontFamily: reading.stack,
    fontSize,
    fontFaceCss: reading.bundled ? bundledReadingFontFaceCss() : '',
  };
}
