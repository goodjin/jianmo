import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { inlineLocalPreviewImages } from './previewImages';
import { buildExportHtmlString } from '../../src/core/export/htmlExport';

const FIXTURE_DIR = path.resolve(__dirname, '../../e2e/ui-suite/fixture-workspace');
const FIXTURE_MD = path.join(FIXTURE_DIR, 'manual-rich.md');

describe('真实验收文档的本地图片内联', () => {
  it('exists/sample-orange/sample-green 变成 data URL，缺失图保持相对路径', async () => {
    const md = fs.readFileSync(FIXTURE_MD, 'utf-8');
    expect(md).toContain('./assets/exists.png');
    expect(fs.existsSync(path.join(FIXTURE_DIR, 'assets/exists.png'))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_DIR, 'assets/missing.png'))).toBe(false);

    let html = await buildExportHtmlString(md, {
      includeToc: true,
      title: 'Markly',
      mermaidScriptBundling: 'embedded',
    });
    html = inlineLocalPreviewImages(html, FIXTURE_DIR);

    const imgSrcs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)].map((m) => m[1]);
    const dataImgs = imgSrcs.filter((s) => s.startsWith('data:image/png;base64,'));
    expect(dataImgs).toHaveLength(3);
    expect(imgSrcs.filter((s) => s === './assets/missing.png')).toEqual(['./assets/missing.png']);
    expect(imgSrcs.some((s) => s.includes('exists.png'))).toBe(false);
    expect(imgSrcs.some((s) => s.includes('sample-orange.png'))).toBe(false);
    expect(imgSrcs.some((s) => s.includes('sample-green.png'))).toBe(false);
  });
});
