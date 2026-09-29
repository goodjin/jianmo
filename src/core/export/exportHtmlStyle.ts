/**
 * 导出 / 预览文档的排版样式（Markly 文档版式 v2）。
 *
 * - 被「导出 HTML」「Preview 模式」「独立桌面端预览」共用（同一条 buildExportHtmlString 链路）。
 * - 主题 token 统一在此定义：亮/暗两套，随 `darkMode` 与系统偏好切换。
 * - 打印规则集中在文末单个 `@media print` 块里，含 M84 长代码换行、M32 表头重复等既有约定。
 */

export interface ExportStyleOptions {
  darkMode?: boolean;
  /** default：屏读；print-friendly：版心更贴打印 */
  printFriendly?: boolean;
}

interface Palette {
  bg: string;
  text: string;
  heading: string;
  muted: string;
  codeBg: string;
  border: string;
  hairline: string;
  link: string;
  linkHover: string;
  accent: string;
  accentSoft: string;
  quoteBg: string;
  quoteBar: string;
  zebra: string;
  inlineCodeBg: string;
  shadow: string;
  selection: string;
}

const LIGHT: Palette = {
  bg: '#ffffff',
  text: '#24292e',
  heading: '#1b1f24',
  muted: '#57606a',
  codeBg: '#f6f8fa',
  border: '#d0d7de',
  hairline: '#e7eaee',
  link: '#0969da',
  linkHover: '#0550ae',
  accent: '#0969da',
  accentSoft: '#eef4fd',
  quoteBg: '#f6f8fc',
  quoteBar: '#4a7fc9',
  zebra: 'rgba(31, 35, 40, 0.022)',
  inlineCodeBg: 'rgba(31, 35, 40, 0.06)',
  shadow: '0 1px 2px rgba(31, 35, 40, 0.05), 0 4px 14px rgba(31, 35, 40, 0.05)',
  selection: 'rgba(9, 105, 218, 0.18)',
};

const DARK: Palette = {
  bg: '#0d1117',
  text: '#c9d1d9',
  heading: '#e6edf3',
  muted: '#9198a1',
  codeBg: '#161b22',
  border: '#30363d',
  hairline: '#21262d',
  link: '#58a6ff',
  linkHover: '#79b8ff',
  accent: '#58a6ff',
  accentSoft: 'rgba(88, 166, 255, 0.12)',
  quoteBg: 'rgba(110, 118, 129, 0.10)',
  quoteBar: '#58a6ff',
  zebra: 'rgba(110, 118, 129, 0.08)',
  inlineCodeBg: 'rgba(110, 118, 129, 0.24)',
  shadow: '0 1px 2px rgba(1, 4, 9, 0.4), 0 4px 14px rgba(1, 4, 9, 0.32)',
  selection: 'rgba(88, 166, 255, 0.30)',
};

function paletteVars(p: Palette, indent = '      ', important = false): string {
  const lines: Array<[string, string]> = [
    ['--bg-color', p.bg],
    ['--text-color', p.text],
    ['--code-bg', p.codeBg],
    ['--border-color', p.border],
    ['--link-color', p.link],
    ['--link-hover', p.linkHover],
    ['--heading-color', p.heading],
    ['--muted-color', p.muted],
    ['--hairline', p.hairline],
    ['--accent-color', p.accent],
    ['--accent-soft', p.accentSoft],
    ['--quote-bg', p.quoteBg],
    ['--quote-bar', p.quoteBar],
    ['--zebra-bg', p.zebra],
    ['--inline-code-bg', p.inlineCodeBg],
    ['--shadow-sm', p.shadow],
    ['--selection-bg', p.selection],
  ];
  return lines
    .map(([k, v]) => `${indent}${k}: ${v}${important ? ' !important' : ''};`)
    .join('\n');
}

function systemPreferenceBlock(darkMode: boolean): string {
  if (darkMode) {
    return `@media (prefers-color-scheme: dark) {
      :root {
${paletteVars(DARK)}
      }
    }`;
  }
  // 显式浅色导出：系统深色偏好也强制浅色，避免“白底文档被套深色变量”
  return `@media (prefers-color-scheme: light) {
      :root {
${paletteVars(LIGHT)}
      }
    }

    @media (prefers-color-scheme: dark) {
      :root {
${paletteVars(LIGHT, '      ', true)}
      }
    }`;
}

const TYPOGRAPHY_CSS = `
    :root {
      --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
        'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono',
        'PingFang SC', 'Microsoft YaHei', monospace;
    }

    * {
      box-sizing: border-box;
    }

    @media (prefers-reduced-motion: no-preference) {
      html {
        scroll-behavior: smooth;
      }
    }

    body {
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.75;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 860px;
      margin: 0 auto;
      padding: 56px 48px 72px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    ::selection {
      background: var(--selection-bg);
    }

    /* ========== 标题：层级靠字重与留白拉开，h1/h2 用渐隐细线收尾 ========== */
    h1, h2, h3, h4, h5, h6 {
      position: relative;
      color: var(--heading-color);
      font-weight: 650;
      line-height: 1.3;
      letter-spacing: -0.01em;
      margin: 1.8em 0 0.7em;
      scroll-margin-top: 16px;
    }

    h1:first-child {
      margin-top: 0;
    }

    h1 {
      font-size: 2.05em;
      font-weight: 700;
      letter-spacing: -0.022em;
      line-height: 1.22;
      margin-bottom: 0.6em;
      padding-bottom: 0.34em;
      background-image: linear-gradient(to right, var(--border-color), transparent 92%);
      background-repeat: no-repeat;
      background-size: 100% 1px;
      background-position: 0 100%;
    }

    h2 {
      font-size: 1.55em;
      margin-top: 2em;
      margin-bottom: 0.55em;
      padding-bottom: 0.32em;
      background-image: linear-gradient(to right, var(--border-color), transparent 92%);
      background-repeat: no-repeat;
      background-size: 100% 1px;
      background-position: 0 100%;
    }

    h3 {
      font-size: 1.28em;
      margin-top: 1.85em;
      margin-bottom: 0.5em;
    }

    h4 {
      font-size: 1.08em;
      margin-top: 1.7em;
    }

    h5 {
      font-size: 0.95em;
      color: var(--muted-color);
    }

    h6 {
      font-size: 0.88em;
      color: var(--muted-color);
      letter-spacing: 0.015em;
    }

    /* 标题悬停显示的锚点（打印隐藏） */
    .markly-anchor {
      position: absolute;
      left: -1.05em;
      top: 0.08em;
      width: 1em;
      color: var(--muted-color);
      font-size: 0.9em;
      font-weight: 500;
      text-decoration: none;
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    h1:hover .markly-anchor,
    h2:hover .markly-anchor,
    h3:hover .markly-anchor,
    h4:hover .markly-anchor,
    h5:hover .markly-anchor,
    h6:hover .markly-anchor,
    .markly-anchor:focus-visible {
      opacity: 0.85;
    }

    /* ========== 段落、列表、任务 ========== */
    p {
      margin: 0 0 1.15em;
    }

    p:last-child {
      margin-bottom: 0;
    }

    ul, ol {
      margin: 0 0 1.15em;
      padding-left: 1.6em;
    }

    ul { list-style-type: disc; }
    ul ul { list-style-type: circle; }
    ul ul ul { list-style-type: square; }

    li {
      margin: 0.32em 0;
    }

    li::marker {
      color: var(--muted-color);
    }

    li > p {
      margin-bottom: 0.55em;
    }

    li > p:last-child {
      margin-bottom: 0;
    }

    li > ul, li > ol {
      margin-top: 0.35em;
      margin-bottom: 0.35em;
    }

    .task-list-item,
    li:has(> input[type='checkbox']) {
      list-style: none;
      margin-left: -1.35em;
    }

    input[type='checkbox'] {
      accent-color: var(--accent-color);
      margin-right: 0.5em;
      vertical-align: -0.12em;
    }

    /* ========== 引用、分隔线 ========== */
    blockquote {
      margin: 0 0 1.15em;
      padding: 0.95em 1.3em;
      color: var(--muted-color);
      background: var(--quote-bg);
      border-left: 4px solid var(--quote-bar);
      border-radius: 0 10px 10px 0;
    }

    blockquote > :last-child {
      margin-bottom: 0;
    }

    hr {
      height: 1px;
      border: 0;
      margin: 2.2em 0;
      background: linear-gradient(
        to right,
        transparent,
        var(--border-color) 12%,
        var(--border-color) 88%,
        transparent
      );
    }

    /* ========== 代码 ========== */
    code {
      font-family: var(--font-mono);
      font-size: 0.875em;
      background: var(--inline-code-bg);
      color: var(--text-color);
      padding: 0.15em 0.4em;
      border-radius: 6px;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    pre {
      position: relative;
      margin: 0 0 1.15em;
      padding: 16px 18px;
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow-x: auto;
      overflow-y: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
      box-shadow: var(--shadow-sm);
    }

    pre code {
      background: none;
      border: 0;
      padding: 0;
      color: inherit;
      font-size: 13.5px;
      line-height: 1.72;
    }

    pre::-webkit-scrollbar {
      height: 10px;
      width: 10px;
    }

    pre::-webkit-scrollbar-track {
      background: transparent;
    }

    pre::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 999px;
      border: 2px solid var(--code-bg);
    }

    /* 代码块增强（渲染期 JS 包裹 .markly-codeblock；无 JS 时 pre 仍自成一体） */
    .markly-codeblock {
      position: relative;
      margin: 0 0 1.15em;
    }

    .markly-codeblock pre {
      margin-bottom: 0;
    }

    .markly-code-lang {
      position: absolute;
      top: 8px;
      right: 10px;
      z-index: 1;
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1;
      letter-spacing: 0.04em;
      color: var(--muted-color);
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 999px;
      padding: 4px 9px;
      user-select: none;
    }

    .markly-code-copy {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      font-family: var(--font-body);
      font-size: 12px;
      line-height: 1;
      color: var(--muted-color);
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 5px 10px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    .markly-codeblock:hover .markly-code-copy,
    .markly-code-copy:focus-visible {
      opacity: 1;
    }

    .markly-code-copy:hover {
      color: var(--accent-color);
      border-color: var(--accent-color);
    }

    /* ========== 表格 ========== */
    .markly-table-wrap {
      margin: 0 0 1.15em;
      overflow-x: auto;
    }

    table {
      width: 100%;
      margin: 0 0 1.15em;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      font-size: 0.95em;
    }

    .markly-table-wrap table {
      margin-bottom: 0;
    }

    th, td {
      padding: 10px 14px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--hairline);
      overflow-wrap: break-word;
    }

    th {
      background: var(--accent-soft);
      color: var(--heading-color);
      font-weight: 600;
      border-bottom-color: var(--border-color);
    }

    tbody tr:nth-child(even) {
      background: var(--zebra-bg);
    }

    tbody tr:last-child > td {
      border-bottom: 0;
    }

    /* ========== 图片、行内元素 ========== */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }

    a:hover,
    a:focus-visible {
      color: var(--link-hover);
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
    }

    kbd {
      font-family: var(--font-mono);
      font-size: 0.82em;
      color: var(--text-color);
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-bottom-width: 2px;
      border-radius: 6px;
      padding: 0.12em 0.45em;
    }

    mark {
      background: rgba(255, 210, 0, 0.32);
      color: inherit;
      padding: 0.05em 0.25em;
      border-radius: 4px;
    }

    sup, sub {
      font-size: 0.78em;
      line-height: 0;
      position: relative;
      vertical-align: baseline;
    }

    sup { top: -0.45em; }
    sub { bottom: -0.2em; }

    del {
      color: var(--muted-color);
    }

    abbr[title] {
      text-decoration: underline dotted;
      cursor: help;
    }

    strong, b {
      font-weight: 650;
      color: var(--heading-color);
    }

    /* ========== 定义列表 / 折叠块 ========== */
    dl {
      margin: 0 0 1.15em;
    }

    dt {
      font-weight: 600;
      color: var(--heading-color);
      margin-top: 0.85em;
    }

    dd {
      margin: 0.25em 0 0 1.3em;
    }

    details {
      margin: 0 0 1.15em;
      padding: 0.85em 1.15em;
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
    }

    summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--heading-color);
    }

    details > :last-child {
      margin-bottom: 0;
    }

    /* ========== 目录 ========== */
    .toc {
      margin: 0 0 44px;
      padding: 22px 26px 18px;
      background: var(--accent-soft);
      border: 1px solid var(--border-color);
      border-radius: 12px;
    }

    .toc h2 {
      font-size: 0.82em;
      font-weight: 600;
      letter-spacing: 0.09em;
      color: var(--muted-color);
      margin: 0 0 12px;
      padding: 0;
      background-image: none;
    }

    .toc ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .toc li {
      margin: 7px 0;
      line-height: 1.55;
    }

    .toc li::marker {
      content: none;
    }

    .toc a {
      color: var(--text-color);
      text-decoration: none;
    }

    .toc a:hover,
    .toc a:focus-visible {
      color: var(--accent-color);
    }

    .toc li.toc-diagram a {
      color: var(--muted-color);
    }

    /* ========== 脚注 ========== */
    .footnote {
      margin-top: 3em;
      padding-top: 1.4em;
      border-top: 1px solid var(--hairline);
      font-size: 0.92em;
      color: var(--muted-color);
    }
`;

const PRINT_FRIENDLY_CSS = `
    body.markly-export-print-friendly {
      max-width: none;
      font-size: 11pt;
      padding: 24px 12px;
    }

    body.markly-export-print-friendly pre {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      tab-size: 4;
    }
`;

const PRINT_CSS = `
    /* 打印样式（M84：围栏代码可跨页；blockquote 仍尽量整块） */
    @media print {
      body {
        max-width: 100%;
        padding: 0;
      }

      .toc {
        page-break-after: always;
      }

      pre {
        page-break-inside: auto;
        break-inside: auto;
        white-space: pre-wrap;
        overflow: visible;
        overflow-wrap: anywhere;
        word-break: break-word;
        box-shadow: none;
      }

      pre code {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      blockquote {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* M32：分页时尽量重复表头（依赖 UA 对 thead 的表格头组语义） */
      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      table {
        page-break-inside: auto;
        break-inside: auto;
      }

      tr,
      th,
      td {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* 屏读专用的浮层元素不上纸 */
      .markly-code-copy,
      .markly-code-lang,
      .markly-anchor {
        display: none !important;
      }

      a {
        text-decoration: underline;
      }

      a[href^='http']::after {
        content: ' (' attr(href) ')';
        font-size: 0.85em;
        color: var(--muted-color);
        word-break: break-all;
      }
    }
`;

export function buildExportHtmlStyle(opts: ExportStyleOptions = {}): string {
  const darkMode = !!opts.darkMode;
  const printFriendly = !!opts.printFriendly;
  return `  <style>
    :root {
${paletteVars(darkMode ? DARK : LIGHT)}
    }

    ${systemPreferenceBlock(darkMode)}
${TYPOGRAPHY_CSS}
${printFriendly ? PRINT_FRIENDLY_CSS : ''}
${PRINT_CSS}
  </style>`;
}
