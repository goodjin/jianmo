import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { rewriteLocalImgSrcForPreview } from '../htmlPreviewImgRewrite';

describe('htmlPreviewImgRewrite (M88)', () => {
  it('rewrites existing relative img via injected URL mapper', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-prev-'));
    fs.writeFileSync(path.join(root, 'a.png'), 'fake');
    const html = '<p><img src="./a.png" alt="x"></p>';
    const out = rewriteLocalImgSrcForPreview(html, root, (abs) => `mapped:${abs}`);
    expect(out).toContain('mapped:');
    expect(out).not.toBe(html);
  });

  it('leaves https img unchanged', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-prev-'));
    const html = '<img src="https://x/y.png">';
    expect(rewriteLocalImgSrcForPreview(html, root, (p) => p)).toBe(html);
  });
});
