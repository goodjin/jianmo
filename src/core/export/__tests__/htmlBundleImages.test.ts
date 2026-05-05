import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  extractImgSrcsFromHtml,
  isRemoteOrSpecialImgSrc,
  isResolvedPathUnderDir,
  bundleHtmlLocalImages,
  sanitizeAssetsSubdirectory,
} from '../htmlBundleImages';

describe('extractImgSrcsFromHtml', () => {
  it('collects quoted src values uniquely', () => {
    const html =
      '<p><img src="./a.png" alt="1"><img src=\'./b.png\'></p><img src="./a.png">';
    expect(extractImgSrcsFromHtml(html).sort()).toEqual(['./a.png', './b.png']);
  });
});

describe('isRemoteOrSpecialImgSrc', () => {
  it('skips http(s), data, mailto, empty', () => {
    expect(isRemoteOrSpecialImgSrc('')).toBe(true);
    expect(isRemoteOrSpecialImgSrc('https://x/y.png')).toBe(true);
    expect(isRemoteOrSpecialImgSrc('http://x/y.png')).toBe(true);
    expect(isRemoteOrSpecialImgSrc('data:image/png;base64,xx')).toBe(true);
    expect(isRemoteOrSpecialImgSrc('mailto:a@b')).toBe(true);
    expect(isRemoteOrSpecialImgSrc('./x.png')).toBe(false);
  });
});

describe('isResolvedPathUnderDir', () => {
  it('rejects traversal outside base', () => {
    const base = path.join('/tmp', 'doc');
    const evil = path.join(base, '..', 'etc', 'passwd');
    expect(isResolvedPathUnderDir(evil, base)).toBe(false);
  });

  it('accepts file under base', () => {
    const base = path.join('/tmp', 'doc');
    const child = path.join(base, 'img', 'x.png');
    expect(isResolvedPathUnderDir(child, base)).toBe(true);
  });
});

describe('sanitizeAssetsSubdirectory', () => {
  it('returns default for path-like input', () => {
    expect(sanitizeAssetsSubdirectory('a/b')).toBe('markly-html-assets');
    expect(sanitizeAssetsSubdirectory('..')).toBe('markly-html-assets');
  });

  it('accepts single segment name', () => {
    expect(sanitizeAssetsSubdirectory('my-assets')).toBe('my-assets');
  });
});

describe('bundleHtmlLocalImages', () => {
  it('copies nested image and rewrites src', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-hb-'));
    const docDir = path.join(root, 'doc');
    fs.mkdirSync(docDir, { recursive: true });
    const imgDir = path.join(docDir, 'img');
    fs.mkdirSync(imgDir, { recursive: true });
    fs.writeFileSync(path.join(imgDir, 'x.png'), 'png-bytes');

    const outDir = path.join(root, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const outHtml = path.join(outDir, 'page.html');

    const htmlIn = '<body><img src="./img/x.png" alt="x"></body>';
    const { html, copiedFiles, skipped } = bundleHtmlLocalImages({
      html: htmlIn,
      documentDir: docDir,
      outputHtmlPath: outHtml,
      assetsSubdirectory: 'pack',
    });

    expect(skipped).toHaveLength(0);
    expect(copiedFiles).toHaveLength(1);
    expect(fs.existsSync(path.join(outDir, 'pack', 'img', 'x.png'))).toBe(true);
    expect(html).toContain('src="./pack/img/x.png"');
    expect(html).not.toContain('src="./img/x.png"');
  });

  it('skips missing files with reason', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-hb2-'));
    const docDir = path.join(root, 'doc');
    fs.mkdirSync(docDir, { recursive: true });
    const outHtml = path.join(root, 'out.html');
    const { skipped, copiedFiles } = bundleHtmlLocalImages({
      html: '<img src="./nope.png">',
      documentDir: docDir,
      outputHtmlPath: outHtml,
      assetsSubdirectory: 'p',
    });
    expect(copiedFiles).toHaveLength(0);
    expect(skipped.some((s) => s.src === './nope.png' && s.reason === 'not_found')).toBe(true);
  });
});
