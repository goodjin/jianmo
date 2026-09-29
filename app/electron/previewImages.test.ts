import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_INLINE_IMAGE_BYTES,
  fileToDataUrl,
  inlineLocalPreviewImages,
  mimeFromExt,
} from './previewImages';

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-preview-img-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('mimeFromExt', () => {
  it('按扩展名返回常见图片 MIME（大小写不敏感）', () => {
    expect(mimeFromExt('.png')).toBe('image/png');
    expect(mimeFromExt('.JPG')).toBe('image/jpeg');
    expect(mimeFromExt('.jpeg')).toBe('image/jpeg');
    expect(mimeFromExt('.svg')).toBe('image/svg+xml');
    expect(mimeFromExt('.webp')).toBe('image/webp');
  });

  it('未知扩展名回退 application/octet-stream', () => {
    expect(mimeFromExt('.xyz')).toBe('application/octet-stream');
    expect(mimeFromExt('')).toBe('application/octet-stream');
  });
});

describe('fileToDataUrl', () => {
  it('把文件内容编成对应 MIME 的 data URL', () => {
    const dir = tmpDir();
    const abs = path.join(dir, 'a.png');
    fs.writeFileSync(abs, Buffer.from('PNGDATA'));
    expect(fileToDataUrl(abs)).toBe(`data:image/png;base64,${Buffer.from('PNGDATA').toString('base64')}`);
  });

  it('缺失路径或目录 → null', () => {
    const dir = tmpDir();
    expect(fileToDataUrl(path.join(dir, 'missing.png'))).toBeNull();
    expect(fileToDataUrl(dir)).toBeNull();
  });

  it('超过大小上限 → null，不内联', () => {
    const dir = tmpDir();
    const abs = path.join(dir, 'big.png');
    fs.writeFileSync(abs, Buffer.alloc(MAX_INLINE_IMAGE_BYTES + 1, 1));
    expect(fileToDataUrl(abs)).toBeNull();
  });
});

describe('inlineLocalPreviewImages', () => {
  it('相对路径且文件存在 → 改写为 data URL', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'pic.png'), 'IMG');
    const html = '<p><img src="./pic.png" alt="x"></p>';
    const out = inlineLocalPreviewImages(html, dir);
    expect(out).toContain('data:image/png;base64,');
    expect(out).toContain('alt="x"');
    expect(out).not.toContain('src="./pic.png"');
  });

  it('百分号编码的相对路径也能解析', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'my pic.png'), 'IMG');
    const html = '<img src="./my%20pic.png">';
    const out = inlineLocalPreviewImages(html, dir);
    expect(out).toContain('data:image/png;base64,');
    expect(out).not.toContain('my%20pic.png');
  });

  it('https / data 图片原样保留', () => {
    const dir = tmpDir();
    const html = '<img src="https://example.com/a.png"><img src="data:image/png;base64,AAA">';
    expect(inlineLocalPreviewImages(html, dir)).toBe(html);
  });

  it('缺失文件或逃出文档目录 → 不改写', () => {
    const dir = tmpDir();
    const outside = tmpDir();
    fs.writeFileSync(path.join(outside, 'secret.png'), 'NO');
    const html = '<img src="./missing.png"><img src="../secret.png">';
    expect(inlineLocalPreviewImages(html, dir)).toBe(html);
  });

  it('文档目录不存在时原样返回', () => {
    const html = '<img src="./a.png">';
    expect(inlineLocalPreviewImages(html, path.join(os.tmpdir(), 'markly-no-such-dir'))).toBe(html);
  });
});
