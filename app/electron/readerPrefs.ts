/**
 * 独立应用的阅读偏好（不进 VSCode 的 ExtensionConfig）。
 * 落在 ~/.markly/config.json 的 `reader` 字段里，和外观设置放在一起。
 */

export interface ReaderPrefs {
  /** 预览里选中文字后自动写入系统剪贴板。 */
  copyOnSelect: boolean;
}

export const DEFAULT_COPY_ON_SELECT = true;

export function readReaderPrefs(config: unknown): ReaderPrefs {
  const root = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const nested =
    root.reader && typeof root.reader === 'object' ? (root.reader as Record<string, unknown>) : root;
  return {
    copyOnSelect: typeof nested.copyOnSelect === 'boolean' ? nested.copyOnSelect : DEFAULT_COPY_ON_SELECT,
  };
}

/** 只认 copyOnSelect。没有有效改动时返回 null。 */
export function normalizeReaderPatch(raw: unknown): Partial<ReaderPrefs> | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!('copyOnSelect' in raw)) return null;
  const value = (raw as { copyOnSelect?: unknown }).copyOnSelect;
  if (typeof value !== 'boolean') return null;
  return { copyOnSelect: value };
}
