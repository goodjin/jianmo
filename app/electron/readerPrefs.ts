/**
 * 独立应用的阅读偏好（不进 VSCode 的 ExtensionConfig）。
 * 落在 ~/.markly/config.json 的 `reader` 字段里，和外观设置放在一起。
 */

export interface ReaderPrefs {
  /** 预览里选中文字后自动写入系统剪贴板。 */
  copyOnSelect: boolean;
  /** 同时打开的标签上限。超过后关掉最久没有查看的那一张。 */
  maxOpenTabs: number;
}

export const DEFAULT_COPY_ON_SELECT = true;
export const DEFAULT_MAX_OPEN_TABS = 20;
export const MIN_MAX_OPEN_TABS = 1;
export const MAX_MAX_OPEN_TABS = 40;

export function clampMaxOpenTabs(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_MAX_OPEN_TABS;
  return Math.min(MAX_MAX_OPEN_TABS, Math.max(MIN_MAX_OPEN_TABS, Math.round(n)));
}

export function readReaderPrefs(config: unknown): ReaderPrefs {
  const root = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const nested =
    root.reader && typeof root.reader === 'object' ? (root.reader as Record<string, unknown>) : root;
  return {
    copyOnSelect: typeof nested.copyOnSelect === 'boolean' ? nested.copyOnSelect : DEFAULT_COPY_ON_SELECT,
    maxOpenTabs: 'maxOpenTabs' in nested ? clampMaxOpenTabs(nested.maxOpenTabs) : DEFAULT_MAX_OPEN_TABS,
  };
}

/** 只认 copyOnSelect 和 maxOpenTabs。没有有效改动时返回 null。 */
export function normalizeReaderPatch(raw: unknown): Partial<ReaderPrefs> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const patch: Partial<ReaderPrefs> = {};
  if ('copyOnSelect' in src && typeof src.copyOnSelect === 'boolean') {
    patch.copyOnSelect = src.copyOnSelect;
  }
  if ('maxOpenTabs' in src && typeof src.maxOpenTabs === 'number' && Number.isFinite(src.maxOpenTabs)) {
    patch.maxOpenTabs = clampMaxOpenTabs(src.maxOpenTabs);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
