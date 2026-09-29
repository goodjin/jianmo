import { describe, expect, it } from 'vitest';
import {
  PREVIEW_THEME_MARKER,
  applyPreviewTheme,
  buildPreviewThemeCss,
  normalizePreviewFontSize,
  sanitizeFontFamily,
} from './previewTheme';
import { getEditorPalette } from '../../webview/src/shared/themeConfig';

const DRACULA = getEditorPalette('dracula');
const GITHUB_LIGHT = getEditorPalette('github-light');

describe('normalizePreviewFontSize', () => {
  it('正常值原样取整', () => {
    expect(normalizePreviewFontSize(18)).toBe(18);
    expect(normalizePreviewFontSize(15.6)).toBe(16);
  });

  it('越界收敛到 8–72', () => {
    expect(normalizePreviewFontSize(2)).toBe(8);
    expect(normalizePreviewFontSize(500)).toBe(72);
  });

  it('非法值退回 16', () => {
    expect(normalizePreviewFontSize(undefined)).toBe(16);
    expect(normalizePreviewFontSize('18')).toBe(16);
    expect(normalizePreviewFontSize(NaN)).toBe(16);
    expect(normalizePreviewFontSize(Infinity)).toBe(16);
  });
});

describe('sanitizeFontFamily', () => {
  it('保留正常字体栈', () => {
    expect(sanitizeFontFamily("  'PingFang SC', sans-serif ")).toBe("'PingFang SC', sans-serif");
  });

  it('掐掉可能截断声明或起新规则的字符', () => {
    expect(sanitizeFontFamily('Arial; } body { display: none')).toBe('Arial  body  display: none');
    expect(sanitizeFontFamily('Arial</style><script>')).toBe('Arial/stylescript');
  });

  it('空值与非字符串给空串', () => {
    expect(sanitizeFontFamily('')).toBe('');
    expect(sanitizeFontFamily('   ')).toBe('');
    expect(sanitizeFontFamily(null)).toBe('');
    expect(sanitizeFontFamily(42)).toBe('');
  });
});

describe('buildPreviewThemeCss', () => {
  it('写入所选配色的各项颜色', () => {
    const css = buildPreviewThemeCss(DRACULA);
    expect(css).toContain(`--bg-color: ${DRACULA.colors.background}`);
    expect(css).toContain(`--text-color: ${DRACULA.colors.text}`);
    expect(css).toContain(`--link-color: ${DRACULA.colors.link}`);
    expect(css).toContain(`--code-bg: ${DRACULA.colors.codeBackground}`);
    expect(css).toContain(`color: ${DRACULA.colors.heading}`);
  });

  it('换配色就换出一份不同的 CSS', () => {
    expect(buildPreviewThemeCss(DRACULA)).not.toBe(buildPreviewThemeCss(GITHUB_LIGHT));
    expect(buildPreviewThemeCss(GITHUB_LIGHT)).toContain('--bg-color: #ffffff');
  });

  it('覆盖导出 CSS 里写死的灰色引用块与脚注', () => {
    const css = buildPreviewThemeCss(DRACULA);
    expect(css).toMatch(/blockquote,\s*\n\s*\.footnote \{\s*\n\s*color: /);
    expect(css).toContain(DRACULA.colors.textSecondary);
  });

  it('给了字体就写 font-family，没给就只写字号', () => {
    const withFont = buildPreviewThemeCss(DRACULA, { fontFamily: 'Menlo, monospace', fontSize: 20 });
    expect(withFont).toContain('font-family: Menlo, monospace;');
    expect(withFont).toContain('font-size: 20px;');

    const noFont = buildPreviewThemeCss(DRACULA, { fontSize: 20 });
    expect(noFont).not.toContain('font-family');
    expect(noFont).toContain('font-size: 20px;');
  });

  it('未给字号时用 16px 兜底', () => {
    expect(buildPreviewThemeCss(DRACULA)).toContain('font-size: 16px;');
  });
});

describe('applyPreviewTheme', () => {
  const HTML = '<!DOCTYPE html><html><head><style>:root{--bg-color:#fff;}</style></head><body><h1>标题</h1></body></html>';

  it('样式插在 </head> 之前，因而压过前面的配色定义', () => {
    const out = applyPreviewTheme(HTML, DRACULA);
    const injected = out.indexOf(PREVIEW_THEME_MARKER);
    expect(injected).toBeGreaterThan(-1);
    expect(injected).toBeLessThan(out.indexOf('</head>'));
    expect(injected).toBeGreaterThan(out.indexOf('--bg-color:#fff'));
    expect(out).toContain(`--bg-color: ${DRACULA.colors.background}`);
  });

  it('正文与结构原样保留', () => {
    const out = applyPreviewTheme(HTML, DRACULA);
    expect(out).toContain('<body><h1>标题</h1></body>');
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('大写 </HEAD> 也能命中', () => {
    const out = applyPreviewTheme('<html><HEAD></HEAD><body>x</body></html>', DRACULA);
    expect(out).toContain(PREVIEW_THEME_MARKER);
  });

  it('没有 head 时原样返回，不产出坏文档', () => {
    const broken = '<div>没有 head</div>';
    expect(applyPreviewTheme(broken, DRACULA)).toBe(broken);
  });

  it('非字符串输入给空串', () => {
    expect(applyPreviewTheme(undefined as unknown as string, DRACULA)).toBe('');
  });

  it('字体设置一并注入', () => {
    const out = applyPreviewTheme(HTML, GITHUB_LIGHT, { fontFamily: 'Georgia, serif', fontSize: 22 });
    expect(out).toContain('font-family: Georgia, serif;');
    expect(out).toContain('font-size: 22px;');
  });
});
