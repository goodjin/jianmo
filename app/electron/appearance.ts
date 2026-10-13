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

/**
 * 正文字体。思源黑体（Noto Sans SC）打进桌面应用，不依赖用户电脑是否安装。
 * 空 stack 表示系统默认：预览时换成操作系统字体栈，且不嵌入字体文件。
 */
export const READING_FONT_STACK =
  '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/** 真正的系统界面字体。不含思源黑体，避免又用回打进应用的那套。 */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const DEFAULT_FONT_FAMILY = READING_FONT_STACK;

export const FONT_FAMILY_OPTIONS: readonly FontFamilyOption[] = [
  { id: 'source-han-sans', name: '思源黑体', stack: READING_FONT_STACK },
  { id: 'system', name: '系统默认', stack: '' },
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

/**
 * 只接受内置字体栈，避免把任意字符串写进配置再注入 CSS。
 * 空字符串是「系统默认」。没写、或写了不再提供的旧字体，回到思源黑体。
 */
export function normalizeFontFamily(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_FONT_FAMILY;
  const s = raw.trim();
  if (!s || s === SYSTEM_FONT_STACK) return '';
  return FONT_FAMILY_OPTIONS.some((o) => o.stack === s) ? s : DEFAULT_FONT_FAMILY;
}

/** 预览正文实际要用的字体。系统默认展开成操作系统字体栈，且不带字体文件。 */
export function readingFontForPreview(raw: unknown): { stack: string; bundled: boolean } {
  const stored = normalizeFontFamily(raw);
  if (!stored) return { stack: SYSTEM_FONT_STACK, bundled: false };
  return { stack: stored, bundled: stored.includes('Noto Sans SC') };
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
