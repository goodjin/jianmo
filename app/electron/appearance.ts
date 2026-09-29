/**
 * 外观设置（主题 / 字体 / 字号）的取值与校验：纯函数，不碰 electron / fs。
 *
 * 设置页与主进程共用这里的选项表和归一化逻辑，避免两边各写一套白名单。
 */

import type { EditorThemeSetting, ExtensionConfig } from '../../src/types';
import { isEditorThemeSetting } from '../../src/types';

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 28;
export const DEFAULT_FONT_SIZE = 16;

/** 设置页下拉里的字号档位。 */
export const FONT_SIZE_OPTIONS: readonly number[] = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28];

export interface FontFamilyOption {
  id: string;
  name: string;
  /** CSS font-family 栈 */
  stack: string;
}

/** 内置字体栈。空 stack 表示跟随预览默认字体。 */
export const FONT_FAMILY_OPTIONS: readonly FontFamilyOption[] = [
  { id: 'system', name: '系统默认', stack: '' },
  {
    id: 'sans',
    name: '无衬线（Helvetica）',
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  { id: 'serif', name: '衬线（Georgia）', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', name: '等宽（Menlo）', stack: "'SFMono-Regular', Menlo, Consolas, monospace" },
  { id: 'pingfang', name: '苹方 / 雅黑', stack: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { id: 'songti', name: '宋体', stack: "'Songti SC', SimSun, serif" },
  { id: 'heiti', name: '黑体', stack: "'Heiti SC', 'Microsoft YaHei', sans-serif" },
  { id: 'kaiti', name: '楷体', stack: "'Kaiti SC', KaiTi, serif" },
];

export interface AppearanceSettings {
  theme: EditorThemeSetting;
  fontFamily: string;
  fontSize: number;
}

export function normalizeFontSize(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : NaN;
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n));
}

/** 只接受内置字体栈，避免把任意字符串写进配置再注入 CSS。 */
export function normalizeFontFamily(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  return FONT_FAMILY_OPTIONS.some((o) => o.stack === s) ? s : '';
}

export function normalizeTheme(raw: unknown): EditorThemeSetting {
  return isEditorThemeSetting(raw) ? raw : 'auto';
}

/** 从完整配置里取出设置页关心的三项。 */
export function readAppearance(config: ExtensionConfig): AppearanceSettings {
  return {
    theme: normalizeTheme(config?.editor?.theme),
    fontFamily: normalizeFontFamily(config?.editor?.fontFamily),
    fontSize: normalizeFontSize(config?.editor?.fontSize),
  };
}

/**
 * 归一化来自 renderer 的补丁：只认三个已知键，缺的键不动原值。
 * 返回 null 表示这次补丁没有任何有效改动。
 */
export function normalizeAppearancePatch(raw: unknown): Partial<AppearanceSettings> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const patch: Partial<AppearanceSettings> = {};
  if ('theme' in src && isEditorThemeSetting(src.theme)) patch.theme = src.theme;
  if ('fontFamily' in src && typeof src.fontFamily === 'string') {
    patch.fontFamily = normalizeFontFamily(src.fontFamily);
  }
  if ('fontSize' in src && typeof src.fontSize === 'number' && Number.isFinite(src.fontSize)) {
    patch.fontSize = normalizeFontSize(src.fontSize);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
