import { describe, expect, it } from 'vitest';
import { READING_FONT_STACK, fontStackForFamily } from './appearance';
import { listInstalledFontFamilies } from './systemFonts';
import { applyPreviewTheme } from './previewTheme';
import { getEditorPalette } from '../../webview/src/shared/themeConfig';
import { bundledReadingFontFaceCss, previewFontOptions, readBundledFont } from './readingFontFace';

const DOC = '<!DOCTYPE html><html><head><style>body{font-family:serif}</style></head><body><h1>周末笔记</h1><p>番茄、鸡蛋、<strong>青菜</strong></p></body></html>';
const PALETTE = getEditorPalette('github-light');

describe('打进应用的思源黑体', () => {
  it('字体文件是 woff2，常规和粗体都嵌进 @font-face', () => {
    const regular = readBundledFont('NotoSansSC-Regular.woff2');
    const bold = readBundledFont('NotoSansSC-Bold.woff2');
    expect(regular.subarray(0, 4).toString()).toBe('wOF2');
    expect(bold.subarray(0, 4).toString()).toBe('wOF2');
    expect(regular.length).toBeGreaterThan(500_000);
    expect(bold.length).toBeGreaterThan(500_000);

    const css = bundledReadingFontFaceCss();
    expect(css).toContain(regular.subarray(0, 48).toString('base64'));
    expect(css).toContain(bold.subarray(0, 48).toString('base64'));
    expect(css).toContain('font-weight:400');
    expect(css).toContain('font-weight:700');
    expect(css).toContain("font-family:'Noto Sans SC'");
  });

  it('选中思源黑体时，正文样式用这套字，并且带上字体文件', () => {
    const font = previewFontOptions(READING_FONT_STACK, 18);
    const html = applyPreviewTheme(DOC, PALETTE, font);
    expect(html).toContain('--font-body: "Noto Sans SC"');
    expect(html).toContain('font-family: var(--font-body);');
    expect(html).toContain('@font-face');
    expect(html).toContain('font-weight:700');
    expect(html).toContain(readBundledFont('NotoSansSC-Regular.woff2').subarray(0, 24).toString('base64'));
    expect(html).toContain('<h1>周末笔记</h1>');
    expect(html).toContain('font-size: 18px;');
  });

  it('选中系统里的一款字体时，正文用那一款，不嵌入思源黑体', async () => {
    const installed = await listInstalledFontFamilies();
    const family = installed.find((name) => name === 'DejaVu Sans') ?? installed[0]!;
    const stack = fontStackForFamily(family);
    const font = previewFontOptions(stack, 18, installed);
    expect(font.fontFaceCss).toBe('');
    expect(font.fontFamily).toContain(family);
    expect(font.fontFamily).not.toContain('Noto Sans SC');
    const html = applyPreviewTheme(DOC, PALETTE, font);
    expect(html).toContain(`--font-body: ${stack}`);
    expect(html).toContain('font-family: var(--font-body);');
    expect(html).not.toContain('@font-face');
    expect(html).not.toContain('Noto Sans SC');
    expect(html).toContain('<h1>周末笔记</h1>');
  });

  it('记住的系统字体已经不在时，正文回到思源黑体并带上字体文件', async () => {
    const installed = await listInstalledFontFamilies();
    expect(installed).not.toContain('Comic Sans MS');
    const font = previewFontOptions('"Comic Sans MS", sans-serif', 18, installed);
    expect(font.fontFamily).toBe(READING_FONT_STACK);
    expect(font.fontFaceCss).toContain("@font-face");
    expect(font.fontFaceCss).toContain('font-weight:700');
    const html = applyPreviewTheme(DOC, PALETTE, font);
    expect(html).toContain('--font-body: "Noto Sans SC"');
    expect(html).toContain('@font-face');
    expect(html).toContain('<p>番茄、鸡蛋、<strong>青菜</strong></p>');
  });

  it('选系统默认时正文回到操作系统字体，不嵌入思源黑体', () => {
    const font = previewFontOptions('', 16);
    expect(font.fontFaceCss).toBe('');
    expect(font.fontFamily).not.toContain('Noto Sans SC');
    const html = applyPreviewTheme(DOC, PALETTE, font);
    expect(html).toContain('-apple-system');
    expect(html).toContain('PingFang SC');
    expect(html).not.toContain('Noto Sans SC');
    expect(html).not.toContain('@font-face');
    expect(html).toContain('<p>番茄、鸡蛋、<strong>青菜</strong></p>');
  });
});
