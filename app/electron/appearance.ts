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
  /** CSS font-family 栈。空字符串是「系统默认」。 */
  stack: string;
}

/**
 * 正文字体。思源黑体（Noto Sans SC）打进桌面应用，不依赖用户电脑是否安装。
 * 空 stack 表示系统默认：预览时换成操作系统字体栈，且不嵌入字体文件。
 */
export const BUNDLED_FONT_FAMILY = 'Noto Sans SC';

export const READING_FONT_STACK =
  '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/** 真正的系统界面字体。不含思源黑体，避免又用回打进应用的那套。 */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const DEFAULT_FONT_FAMILY = READING_FONT_STACK;

/** 下拉里固定的两项。系统里安装的字体不写在这里，运行时再接在后面。 */
export const PINNED_FONT_OPTIONS: readonly FontFamilyOption[] = [
  { id: 'system', name: '系统默认', stack: '' },
  { id: 'source-han-sans', name: '思源黑体', stack: READING_FONT_STACK },
];

export const FONT_FAMILY_OPTIONS = PINNED_FONT_OPTIONS;

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

/** 家族名能不能写进 CSS、也能当下列表里的一项。 */
export function isSelectableFamilyName(name: string): boolean {
  if (!name || name.length > 120) return false;
  if (name.startsWith('.')) return false;
  return !/[\u0000-\u001f"\\;{}<>]/.test(name);
}

/** 从存下来的 font-family 栈里取出第一款家族名。 */
export function familyNameOf(stack: string): string {
  const s = stack.trim();
  if (s.startsWith('"')) {
    const end = s.indexOf('"', 1);
    return end > 1 ? s.slice(1, end).trim() : '';
  }
  const comma = s.indexOf(',');
  const first = (comma >= 0 ? s.slice(0, comma) : s).trim();
  return first.replace(/^'+|'+$/g, '');
}

/** 系统字体写成带后备的 CSS 栈，名字放进引号，避免空格把声明拆开。 */
export function fontStackForFamily(family: string): string {
  return `"${family}", sans-serif`;
}

/**
 * 同名家族只留一项，并按名称排序。
 * 思源黑体是打进应用的，不从系统列表里再出现一次。
 */
export function dedupeFontFamilies(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!isSelectableFamilyName(name) || name === BUNDLED_FONT_FAMILY) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  out.sort((a, b) => a.localeCompare(b, 'zh-CN', { sensitivity: 'base', numeric: true }));
  return out;
}

/** 下拉项：系统默认、思源黑体，然后是这台电脑上的字体。 */
export function readingFontOptions(systemFamilies: readonly string[] = []): FontFamilyOption[] {
  return [
    ...PINNED_FONT_OPTIONS,
    ...dedupeFontFamilies(systemFamilies).map((name) => ({
      id: `family:${name}`,
      name,
      stack: fontStackForFamily(name),
    })),
  ];
}

export function parseSystemFontList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return dedupeFontFamilies(raw.filter((item): item is string => typeof item === 'string'));
}

/**
 * 空字符串是「系统默认」。没写则用思源黑体。
 * `installed` 是这台电脑枚举到的家族；没传表示还没枚举完，先保留已记住的名字。
 * 传了列表但里面没有这款，就回到思源黑体。
 */
export function normalizeFontFamily(raw: unknown, installed?: readonly string[]): string {
  if (typeof raw !== 'string') return DEFAULT_FONT_FAMILY;
  const s = raw.trim();
  if (!s || s === SYSTEM_FONT_STACK) return '';
  if (s === READING_FONT_STACK) return READING_FONT_STACK;
  const family = familyNameOf(s);
  if (family === BUNDLED_FONT_FAMILY) return READING_FONT_STACK;
  if (!isSelectableFamilyName(family)) return DEFAULT_FONT_FAMILY;
  if (installed === undefined) return fontStackForFamily(family);
  const match = dedupeFontFamilies(installed).find(
    (name) => name === family || name.toLocaleLowerCase() === family.toLocaleLowerCase()
  );
  return match ? fontStackForFamily(match) : DEFAULT_FONT_FAMILY;
}

/** 记住的字体若这台电脑已经没有，返回要写回配置的值。 */
export function reconcileStoredFont(
  stored: unknown,
  installed: readonly string[]
): { fontFamily: string; changed: boolean } {
  const fontFamily = normalizeFontFamily(stored, installed);
  return { fontFamily, changed: fontFamily !== stored };
}

/** 预览正文实际要用的字体。系统默认展开成操作系统字体栈，且不带字体文件。 */
export function readingFontForPreview(
  raw: unknown,
  installed?: readonly string[]
): { stack: string; bundled: boolean } {
  const stored = normalizeFontFamily(raw, installed);
  if (!stored) return { stack: SYSTEM_FONT_STACK, bundled: false };
  if (stored === READING_FONT_STACK) return { stack: stored, bundled: true };
  return { stack: stored, bundled: false };
}

export function normalizeTheme(raw: unknown): EditorThemeSetting {
  return isEditorThemeSetting(raw) ? raw : 'auto';
}

/** 从完整配置里取出设置页关心的三项。 */
export function readAppearance(config: ExtensionConfig, installed?: readonly string[]): AppearanceSettings {
  return {
    theme: normalizeTheme(config?.editor?.theme),
    fontFamily: normalizeFontFamily(config?.editor?.fontFamily, installed),
    fontSize: normalizeFontSize(config?.editor?.fontSize),
  };
}

/**
 * 归一化来自 renderer 的补丁：只认三个已知键，缺的键不动原值。
 * 返回 null 表示这次补丁没有任何有效改动。
 */
export function normalizeAppearancePatch(
  raw: unknown,
  installed?: readonly string[]
): Partial<AppearanceSettings> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const patch: Partial<AppearanceSettings> = {};
  if ('theme' in src && isEditorThemeSetting(src.theme)) patch.theme = src.theme;
  if ('fontFamily' in src && typeof src.fontFamily === 'string') {
    patch.fontFamily = normalizeFontFamily(src.fontFamily, installed);
  }
  if ('fontSize' in src && typeof src.fontSize === 'number' && Number.isFinite(src.fontSize)) {
    patch.fontSize = normalizeFontSize(src.fontSize);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
