/**
 * 独立应用的阅读偏好（不进 VSCode 的 ExtensionConfig）。
 * 落在 ~/.markly/config.json 的 `reader` 字段里，和外观设置放在一起。
 */

export interface ReaderPrefs {
  /** 预览里选中文字后自动写入系统剪贴板。 */
  copyOnSelect: boolean;
  /** 预览、源码、编辑里的长行折到下一行。关掉后长行留在一行，只在正文里横向滚动。 */
  wordWrap: boolean;
}

export const DEFAULT_COPY_ON_SELECT = true;
export const DEFAULT_WORD_WRAP = true;

export function readReaderPrefs(config: unknown): ReaderPrefs {
  const root = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const nested =
    root.reader && typeof root.reader === 'object' ? (root.reader as Record<string, unknown>) : root;
  return {
    copyOnSelect: typeof nested.copyOnSelect === 'boolean' ? nested.copyOnSelect : DEFAULT_COPY_ON_SELECT,
    wordWrap: typeof nested.wordWrap === 'boolean' ? nested.wordWrap : DEFAULT_WORD_WRAP,
  };
}

/** 只认 copyOnSelect / wordWrap。没有有效改动时返回 null。 */
export function normalizeReaderPatch(raw: unknown): Partial<ReaderPrefs> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const patch: Partial<ReaderPrefs> = {};
  if (typeof src.copyOnSelect === 'boolean') patch.copyOnSelect = src.copyOnSelect;
  if (typeof src.wordWrap === 'boolean') patch.wordWrap = src.wordWrap;
  return Object.keys(patch).length > 0 ? patch : null;
}
