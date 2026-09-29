/**
 * 编辑器配色主题 ID（设置项 `markly.editor.theme`）。
 * - auto / light / dark：兼容旧配置
 * - 其余为可选的业界常见配色（顶栏设置面板）
 */

export const EDITOR_PALETTE_IDS = [
  'github-light',
  'github-dark',
  'vscode-light',
  'vscode-dark',
  'solarized-light',
  'solarized-dark',
  'nord',
  'dracula',
  'monokai',
  'tokyo-night',
] as const;

export type EditorPaletteId = (typeof EDITOR_PALETTE_IDS)[number];

export const EDITOR_THEME_SETTING_IDS = ['auto', 'light', 'dark', ...EDITOR_PALETTE_IDS] as const;

export type EditorThemeSetting = (typeof EDITOR_THEME_SETTING_IDS)[number];

const LIGHT_PALETTE_IDS: ReadonlySet<string> = new Set([
  'github-light',
  'vscode-light',
  'solarized-light',
]);

export function isEditorPaletteId(x: unknown): x is EditorPaletteId {
  return typeof x === 'string' && (EDITOR_PALETTE_IDS as readonly string[]).includes(x);
}

export function isEditorThemeSetting(x: unknown): x is EditorThemeSetting {
  return typeof x === 'string' && (EDITOR_THEME_SETTING_IDS as readonly string[]).includes(x);
}

/** 将设置值解析为实际套用的 10 色盘之一。 */
export function resolveEditorPaletteId(
  setting: string | undefined,
  prefersDark: boolean
): EditorPaletteId {
  if (isEditorPaletteId(setting)) return setting;
  if (setting === 'dark') return 'vscode-dark';
  if (setting === 'light') return 'github-light';
  return prefersDark ? 'github-dark' : 'github-light';
}

export function isDarkEditorPaletteId(id: EditorPaletteId): boolean {
  return !LIGHT_PALETTE_IDS.has(id);
}

export function isDarkEditorThemeSetting(theme: string | undefined, prefersDark: boolean): boolean {
  return isDarkEditorPaletteId(resolveEditorPaletteId(theme, prefersDark));
}
