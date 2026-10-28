/**
 * 独立应用的阅读偏好（不进 VSCode 的 ExtensionConfig）。
 * 落在 ~/.markly/config.json 的 `reader` 字段里，和外观设置放在一起。
 */

export type ReadingWidth = 'full' | 'standard' | 'wide' | 'fit';

export interface ReaderPrefs {
  /** 预览里选中文字后自动写入系统剪贴板。 */
  copyOnSelect: boolean;
  /** 预览、源码、编辑里的长行折到下一行。关掉后长行留在一行，只在正文里横向滚动。 */
  wordWrap: boolean;
  /** 同时打开的标签上限。超过后关掉最久没有查看的那一张。 */
  maxOpenTabs: number;
  /**
   * 预览正文阅读宽度。只作用于 Markdown 预览正文，不影响文件树与源码编辑。
   * full=铺满（现状）/ standard≈820 / wide≈980 / fit=适应窗口。
   */
  readingWidth: ReadingWidth;
  /**
   * 是否在文档上方（预览 HTML 内）渲染目录块。
   * 关掉后仍可用左侧大纲跳转；默认开，与原先 includeToc:true 行为一致，避免突然消失。
   */
  showDocToc: boolean;
}

export const DEFAULT_COPY_ON_SELECT = true;
export const DEFAULT_WORD_WRAP = true;
export const DEFAULT_MAX_OPEN_TABS = 20;
export const DEFAULT_READING_WIDTH: ReadingWidth = 'full';
export const DEFAULT_SHOW_DOC_TOC = true;
export const MIN_MAX_OPEN_TABS = 1;
export const MAX_MAX_OPEN_TABS = 40;

export const READING_WIDTH_OPTIONS: ReadonlyArray<{
  id: ReadingWidth;
  label: string;
  hint: string;
  maxPx: number | null;
}> = [
  { id: 'full', label: '铺满', hint: '正文铺满预览区（现状）', maxPx: null },
  { id: 'standard', label: '标准', hint: '约 820 像素居中', maxPx: 820 },
  { id: 'wide', label: '宽屏', hint: '约 980 像素居中', maxPx: 980 },
  { id: 'fit', label: '适应窗口', hint: '随窗口伸缩，居中留白', maxPx: 0 },
];

export function clampMaxOpenTabs(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_MAX_OPEN_TABS;
  return Math.min(MAX_MAX_OPEN_TABS, Math.max(MIN_MAX_OPEN_TABS, Math.round(n)));
}

export function normalizeReadingWidth(value: unknown): ReadingWidth {
  if (value === 'full' || value === 'standard' || value === 'wide' || value === 'fit') return value;
  return DEFAULT_READING_WIDTH;
}

export function readingWidthMaxPx(width: ReadingWidth): number | null {
  const hit = READING_WIDTH_OPTIONS.find((o) => o.id === width);
  if (!hit) return null;
  return hit.maxPx;
}

export function readReaderPrefs(config: unknown): ReaderPrefs {
  const root = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const nested =
    root.reader && typeof root.reader === 'object' ? (root.reader as Record<string, unknown>) : root;
  return {
    copyOnSelect: typeof nested.copyOnSelect === 'boolean' ? nested.copyOnSelect : DEFAULT_COPY_ON_SELECT,
    wordWrap: typeof nested.wordWrap === 'boolean' ? nested.wordWrap : DEFAULT_WORD_WRAP,
    maxOpenTabs: 'maxOpenTabs' in nested ? clampMaxOpenTabs(nested.maxOpenTabs) : DEFAULT_MAX_OPEN_TABS,
    readingWidth: 'readingWidth' in nested ? normalizeReadingWidth(nested.readingWidth) : DEFAULT_READING_WIDTH,
    showDocToc: typeof nested.showDocToc === 'boolean' ? nested.showDocToc : DEFAULT_SHOW_DOC_TOC,
  };
}

/** 只认已知字段。没有有效改动时返回 null。 */
export function normalizeReaderPatch(raw: unknown): Partial<ReaderPrefs> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const patch: Partial<ReaderPrefs> = {};
  if ('copyOnSelect' in src && typeof src.copyOnSelect === 'boolean') {
    patch.copyOnSelect = src.copyOnSelect;
  }
  if ('wordWrap' in src && typeof src.wordWrap === 'boolean') {
    patch.wordWrap = src.wordWrap;
  }
  if ('maxOpenTabs' in src && typeof src.maxOpenTabs === 'number' && Number.isFinite(src.maxOpenTabs)) {
    patch.maxOpenTabs = clampMaxOpenTabs(src.maxOpenTabs);
  }
  if ('readingWidth' in src) {
    const w = normalizeReadingWidth(src.readingWidth);
    if (src.readingWidth === w) patch.readingWidth = w;
  }
  if ('showDocToc' in src && typeof src.showDocToc === 'boolean') {
    patch.showDocToc = src.showDocToc;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
