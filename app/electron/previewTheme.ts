/**
 * 把配色与字体注入预览 HTML：纯字符串处理，不碰 electron / DOM。
 *
 * 预览正文复用导出 HTML 管线（src/core/export/htmlExport.ts），它在 `:root` 上定义
 * --bg-color / --text-color / --code-bg / --border-color / --link-color / --link-hover，
 * 随后可能被 `@media (prefers-color-scheme: dark)` 覆写。这里把覆盖样式追加到 </head> 之前，
 * 靠"同优先级后来者胜"压过那段媒体查询，不必用 !important，也不必改共享的导出管线。
 */

import type { EditorPalette } from '../../webview/src/shared/themeConfig';

export const PREVIEW_THEME_MARKER = 'data-markly-preview-theme';

export interface PreviewFontOptions {
  fontFamily?: string;
  fontSize?: number;
}

/** 字号落在导出管线接受的 8–72px 内；非法值退回 16。 */
export function normalizePreviewFontSize(size: unknown): number {
  const n = typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : NaN;
  if (Number.isNaN(n)) return 16;
  return Math.min(72, Math.max(8, n));
}

/** 字体族要进 CSS 声明，掐掉可能截断声明或起新规则的字符。 */
export function sanitizeFontFamily(family: unknown): string {
  const raw = typeof family === 'string' ? family.trim() : '';
  if (!raw) return '';
  return raw.replace(/[;{}<>]/g, '').trim();
}

export function buildPreviewThemeCss(palette: EditorPalette, font: PreviewFontOptions = {}): string {
  const c = palette.colors;
  const family = sanitizeFontFamily(font.fontFamily);
  const size = normalizePreviewFontSize(font.fontSize);
  const bodyFont = [
    family ? `      font-family: ${family};` : '',
    `      font-size: ${size}px;`,
  ]
    .filter(Boolean)
    .join('\n');

  return `    :root {
      --bg-color: ${c.background};
      --text-color: ${c.text};
      --code-bg: ${c.codeBackground};
      --border-color: ${c.border};
      --link-color: ${c.link};
      --link-hover: ${c.linkHover};
    }
    body {
${bodyFont}
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${c.heading};
    }
    /* 导出 CSS 里这两处是写死的灰，深色配色下会糊掉 */
    blockquote,
    .footnote {
      color: ${c.textSecondary};
    }
    :not(pre) > code {
      color: ${c.code};
    }
    ::selection {
      background: ${c.selection};
      color: ${c.selectionForeground};
    }`;
}

/**
 * 注入到 </head> 之前。找不到 </head> 时原样返回，宁可不上主题也不产出坏文档。
 */
export function applyPreviewTheme(
  html: string,
  palette: EditorPalette,
  font: PreviewFontOptions = {}
): string {
  const source = typeof html === 'string' ? html : '';
  const closing = source.toLowerCase().lastIndexOf('</head>');
  if (closing < 0) return source;
  const style = `  <style ${PREVIEW_THEME_MARKER}>\n${buildPreviewThemeCss(palette, font)}\n  </style>\n`;
  return source.slice(0, closing) + style + source.slice(closing);
}
