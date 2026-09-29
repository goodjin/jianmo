/**
 * 编辑器配色：10 套业界常见主题 + 应用到 DOM 的 CSS 变量。
 * @module shared/themeConfig
 */

import type { EditorPaletteId, EditorThemeSetting } from '../../../src/types';
import { resolveEditorPaletteId } from '../../../src/types';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  selection: string;
  heading: string;
  link: string;
  linkHover: string;
  code: string;
  codeBackground: string;
}

export interface ThemeConfig {
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
}

export type ThemeType = EditorThemeSetting;

export interface EditorPalette {
  id: EditorPaletteId;
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors & {
    selectionForeground: string;
    border: string;
    error: string;
    findMatch: string;
    cursor: string;
  };
}

export const EDITOR_PALETTES: readonly EditorPalette[] = [
  {
    id: 'github-light',
    name: 'GitHub Light',
    type: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f6f8fa',
      text: '#1f2328',
      textSecondary: '#656d76',
      primary: '#0969da',
      selection: '#add6ff',
      selectionForeground: '#1f2328',
      heading: '#1f2328',
      link: '#0969da',
      linkHover: '#0550ae',
      code: '#cf222e',
      codeBackground: '#f6f8fa',
      border: '#d0d7de',
      error: '#cf222e',
      findMatch: '#fff8c5',
      cursor: '#0969da',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    colors: {
      background: '#0d1117',
      surface: '#161b22',
      text: '#e6edf3',
      textSecondary: '#8d96a0',
      primary: '#2f81f7',
      selection: '#264f78',
      selectionForeground: '#e6edf3',
      heading: '#e6edf3',
      link: '#2f81f7',
      linkHover: '#58a6ff',
      code: '#ff7b72',
      codeBackground: '#161b22',
      border: '#30363d',
      error: '#f85149',
      findMatch: '#9e6a03',
      cursor: '#2f81f7',
    },
  },
  {
    id: 'vscode-light',
    name: 'Light+',
    type: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f3f3f3',
      text: '#333333',
      textSecondary: '#6a6a6a',
      primary: '#005fb8',
      selection: '#add6ff',
      selectionForeground: '#000000',
      heading: '#1a1a1a',
      link: '#005fb8',
      linkHover: '#004578',
      code: '#a31515',
      codeBackground: '#f3f3f3',
      border: '#e5e5e5',
      error: '#e51400',
      findMatch: '#515c6a4d',
      cursor: '#000000',
    },
  },
  {
    id: 'vscode-dark',
    name: 'Dark+',
    type: 'dark',
    colors: {
      background: '#1e1e1e',
      surface: '#252526',
      text: '#d4d4d4',
      textSecondary: '#9d9d9d',
      primary: '#007acc',
      selection: '#264f78',
      selectionForeground: '#d4d4d4',
      heading: '#e0e0e0',
      link: '#4daafc',
      linkHover: '#6cb8ff',
      code: '#ce9178',
      codeBackground: '#1e1e1e',
      border: '#3e3e42',
      error: '#f44747',
      findMatch: '#515c6a',
      cursor: '#aeafad',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    colors: {
      background: '#fdf6e3',
      surface: '#eee8d5',
      text: '#657b83',
      textSecondary: '#93a1a1',
      primary: '#268bd2',
      selection: '#d7c9a5',
      selectionForeground: '#073642',
      heading: '#073642',
      link: '#268bd2',
      linkHover: '#1a6ea8',
      code: '#dc322f',
      codeBackground: '#eee8d5',
      border: '#ddd6c1',
      error: '#dc322f',
      findMatch: '#eee8d5',
      cursor: '#657b83',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    type: 'dark',
    colors: {
      background: '#002b36',
      surface: '#073642',
      text: '#839496',
      textSecondary: '#586e75',
      primary: '#268bd2',
      selection: '#16404c',
      selectionForeground: '#fdf6e3',
      heading: '#93a1a1',
      link: '#268bd2',
      linkHover: '#2aa198',
      code: '#dc322f',
      codeBackground: '#073642',
      border: '#0a4553',
      error: '#dc322f',
      findMatch: '#586e75',
      cursor: '#839496',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    colors: {
      background: '#2e3440',
      surface: '#3b4252',
      text: '#eceff4',
      textSecondary: '#d8dee9',
      primary: '#88c0d0',
      selection: '#434c5e',
      selectionForeground: '#eceff4',
      heading: '#eceff4',
      link: '#88c0d0',
      linkHover: '#8fbcbb',
      code: '#bf616a',
      codeBackground: '#3b4252',
      border: '#4c566a',
      error: '#bf616a',
      findMatch: '#5e81ac',
      cursor: '#d8dee9',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    colors: {
      background: '#282a36',
      surface: '#21222c',
      text: '#f8f8f2',
      textSecondary: '#6272a4',
      primary: '#bd93f9',
      selection: '#44475a',
      selectionForeground: '#f8f8f2',
      heading: '#f8f8f2',
      link: '#8be9fd',
      linkHover: '#bd93f9',
      code: '#ff79c6',
      codeBackground: '#21222c',
      border: '#44475a',
      error: '#ff5555',
      findMatch: '#ffb86c',
      cursor: '#f8f8f2',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    type: 'dark',
    colors: {
      background: '#272822',
      surface: '#3e3d32',
      text: '#f8f8f2',
      textSecondary: '#cfcfc2',
      primary: '#a6e22e',
      selection: '#49483e',
      selectionForeground: '#f8f8f2',
      heading: '#f8f8f2',
      link: '#66d9ef',
      linkHover: '#a6e22e',
      code: '#f92672',
      codeBackground: '#3e3d32',
      border: '#49483e',
      error: '#f92672',
      findMatch: '#e6db74',
      cursor: '#f8f8f0',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'dark',
    colors: {
      background: '#1a1b26',
      surface: '#24283b',
      text: '#c0caf5',
      textSecondary: '#565f89',
      primary: '#7aa2f7',
      selection: '#283457',
      selectionForeground: '#c0caf5',
      heading: '#c0caf5',
      link: '#7aa2f7',
      linkHover: '#bb9af7',
      code: '#f7768e',
      codeBackground: '#24283b',
      border: '#3b4261',
      error: '#f7768e',
      findMatch: '#e0af68',
      cursor: '#c0caf5',
    },
  },
];

const PALETTE_BY_ID: ReadonlyMap<EditorPaletteId, EditorPalette> = new Map(
  EDITOR_PALETTES.map((p) => [p.id, p])
);

export function getEditorPalette(id: EditorPaletteId): EditorPalette {
  return PALETTE_BY_ID.get(id) ?? EDITOR_PALETTES[0]!;
}

export function resolveEditorPalette(
  setting: string | undefined,
  prefersDark: boolean
): EditorPalette {
  return getEditorPalette(resolveEditorPaletteId(setting, prefersDark));
}

/** 兼容旧 light/dark 配置对象（useTheme）。 */
export const lightTheme: ThemeConfig = {
  name: 'Light',
  type: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    textSecondary: '#666666',
    primary: '#0066cc',
    selection: '#b3d7ff',
    heading: '#1a1a1a',
    link: '#0066cc',
    linkHover: '#0052a3',
    code: '#d32f2f',
    codeBackground: '#f5f5f5',
  },
};

export const darkTheme: ThemeConfig = {
  name: 'Dark',
  type: 'dark',
  colors: {
    background: '#1e1e1e',
    surface: '#252526',
    text: '#d4d4d4',
    textSecondary: '#a0a0a0',
    primary: '#007acc',
    selection: '#264f78',
    heading: '#e0e0e0',
    link: '#4daafc',
    linkHover: '#6cb8ff',
    code: '#f44747',
    codeBackground: '#2d2d2d',
  },
};

export const getThemeConfig = (type: 'light' | 'dark'): ThemeConfig => {
  return type === 'dark' ? darkTheme : lightTheme;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function surfaceHover(hex: string, dark: boolean): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
  return dark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
}

/** 把配色写到节点上，覆盖 webview 内 `--vscode-*` / `--markly-*`。 */
export function applyEditorPalette(el: HTMLElement, palette: EditorPalette): void {
  const c = palette.colors;
  const dark = palette.type === 'dark';
  const vars: Record<string, string> = {
    '--markly-background': c.background,
    '--markly-surface': c.surface,
    '--markly-text': c.text,
    '--markly-textSecondary': c.textSecondary,
    '--markly-primary': c.primary,
    '--markly-selection': c.selection,
    '--markly-heading': c.heading,
    '--markly-link': c.link,
    '--markly-linkHover': c.linkHover,
    '--markly-code': c.code,
    '--markly-codeBackground': c.codeBackground,
    '--markly-border-color': c.border,
    '--markly-error': c.error,
    '--markly-surfaceHover': surfaceHover(c.primary, dark),
    '--vscode-editor-background': c.background,
    '--vscode-editor-foreground': c.text,
    '--vscode-foreground': c.text,
    '--vscode-editorWidget-background': c.surface,
    '--vscode-editorWidget-border': c.border,
    '--vscode-focusBorder': c.primary,
    '--vscode-descriptionForeground': c.textSecondary,
    '--vscode-textCodeBlock-background': c.codeBackground,
    '--vscode-errorForeground': c.error,
    '--vscode-editor-selectionBackground': c.selection,
    '--vscode-editor-selectionForeground': c.selectionForeground,
    '--vscode-editorCursor-foreground': c.cursor,
    '--vscode-editor-findMatchBackground': c.findMatch,
    '--vscode-toolbar-hoverBackground': surfaceHover(c.primary, dark),
    '--vscode-toolbar-activeBackground': surfaceHover(c.primary, dark),
    '--vscode-tab-activeBackground': c.surface,
    '--vscode-button-secondaryBackground': c.surface,
    '--vscode-sideBar-background': c.surface,
    '--vscode-input-background': c.surface,
    '--vscode-input-foreground': c.text,
    '--vscode-input-border': c.border,
  };
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
  el.setAttribute('data-theme', palette.type);
  el.setAttribute('data-markly-palette', palette.id);
}
