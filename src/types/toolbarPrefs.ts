/**
 * 插件工具栏外观：字号与每个按钮是否显示。
 * 设置项：`markly.editor.toolbarFontSize`、`markly.editor.toolbarButtons`。
 */

export const TOOLBAR_FONT_SIZE_MIN = 10;
export const TOOLBAR_FONT_SIZE_MAX = 18;
export const DEFAULT_TOOLBAR_FONT_SIZE = 11;

export const TOOLBAR_BUTTON_IDS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bold',
  'italic',
  'strike',
  'code',
  'quote',
  'clearFormat',
  'bulletList',
  'orderedList',
  'taskList',
  'link',
  'image',
  'codeBlock',
  'hr',
  'math',
  'table',
  'undo',
  'redo',
  'find',
  'zoomOut',
  'zoomReset',
  'zoomIn',
  'outline',
  'lineNumbers',
  'exportPdf',
  'exportHtml',
] as const;

export type ToolbarButtonId = (typeof TOOLBAR_BUTTON_IDS)[number];

export type ToolbarButtonGroupId =
  | 'heading'
  | 'format'
  | 'list'
  | 'insert'
  | 'table'
  | 'history'
  | 'search'
  | 'zoom'
  | 'view'
  | 'export';

export interface ToolbarButtonCatalogItem {
  id: ToolbarButtonId;
  group: ToolbarButtonGroupId;
  /** 设置面板里看到的名字 */
  settingsLabel: string;
}

export const TOOLBAR_GROUP_ORDER: readonly ToolbarButtonGroupId[] = [
  'heading',
  'format',
  'list',
  'history',
  'insert',
  'table',
  'search',
  'zoom',
  'view',
  'export',
];

export const TOOLBAR_GROUP_LABELS: Record<ToolbarButtonGroupId, string> = {
  heading: '标题',
  format: '格式',
  list: '列表',
  insert: '插入',
  table: '表格',
  history: '撤销',
  search: '查找',
  zoom: '缩放',
  view: '视图',
  export: '导出',
};

export const TOOLBAR_BUTTON_CATALOG: readonly ToolbarButtonCatalogItem[] = [
  { id: 'h1', group: 'heading', settingsLabel: '标题 1' },
  { id: 'h2', group: 'heading', settingsLabel: '标题 2' },
  { id: 'h3', group: 'heading', settingsLabel: '标题 3' },
  { id: 'h4', group: 'heading', settingsLabel: '标题 4' },
  { id: 'h5', group: 'heading', settingsLabel: '标题 5' },
  { id: 'h6', group: 'heading', settingsLabel: '标题 6' },
  { id: 'bold', group: 'format', settingsLabel: '加粗' },
  { id: 'italic', group: 'format', settingsLabel: '斜体' },
  { id: 'strike', group: 'format', settingsLabel: '删除线' },
  { id: 'code', group: 'format', settingsLabel: '行内代码' },
  { id: 'quote', group: 'format', settingsLabel: '引用' },
  { id: 'clearFormat', group: 'format', settingsLabel: '清除格式' },
  { id: 'bulletList', group: 'list', settingsLabel: '无序列表' },
  { id: 'orderedList', group: 'list', settingsLabel: '有序列表' },
  { id: 'taskList', group: 'list', settingsLabel: '任务列表' },
  { id: 'undo', group: 'history', settingsLabel: '撤销' },
  { id: 'redo', group: 'history', settingsLabel: '重做' },
  { id: 'link', group: 'insert', settingsLabel: '链接' },
  { id: 'image', group: 'insert', settingsLabel: '图片' },
  { id: 'codeBlock', group: 'insert', settingsLabel: '代码块' },
  { id: 'hr', group: 'insert', settingsLabel: '分割线' },
  { id: 'math', group: 'insert', settingsLabel: '公式' },
  { id: 'table', group: 'table', settingsLabel: '表格' },
  { id: 'find', group: 'search', settingsLabel: '查找' },
  { id: 'zoomOut', group: 'zoom', settingsLabel: '缩小' },
  { id: 'zoomReset', group: 'zoom', settingsLabel: '重置缩放' },
  { id: 'zoomIn', group: 'zoom', settingsLabel: '放大' },
  { id: 'outline', group: 'view', settingsLabel: '大纲' },
  { id: 'lineNumbers', group: 'view', settingsLabel: '行号' },
  { id: 'exportPdf', group: 'export', settingsLabel: '导出 PDF' },
  { id: 'exportHtml', group: 'export', settingsLabel: '导出 HTML' },
];

const TOOLBAR_BUTTON_ID_SET: ReadonlySet<string> = new Set(TOOLBAR_BUTTON_IDS);

export function isToolbarButtonId(value: unknown): value is ToolbarButtonId {
  return typeof value === 'string' && TOOLBAR_BUTTON_ID_SET.has(value);
}

export function isToolbarFontSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= TOOLBAR_FONT_SIZE_MIN &&
    value <= TOOLBAR_FONT_SIZE_MAX
  );
}

/** 非法或缺失时回到默认字号；越界则夹到 10–18。 */
export function normalizeToolbarFontSize(value: unknown, fallback = DEFAULT_TOOLBAR_FONT_SIZE): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < TOOLBAR_FONT_SIZE_MIN) return TOOLBAR_FONT_SIZE_MIN;
  if (rounded > TOOLBAR_FONT_SIZE_MAX) return TOOLBAR_FONT_SIZE_MAX;
  return rounded;
}

/** 丢掉未知 id 和非布尔值。空输入得到空对象（全部按钮显示）。 */
export function normalizeToolbarButtonMap(value: unknown): Partial<Record<ToolbarButtonId, boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Partial<Record<ToolbarButtonId, boolean>> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!isToolbarButtonId(key) || typeof val !== 'boolean') continue;
    out[key] = val;
  }
  return out;
}

/** 未写明或不是 false 的按钮都显示。 */
export function isToolbarButtonShown(
  map: Partial<Record<ToolbarButtonId, boolean>> | undefined,
  id: string
): boolean {
  if (!isToolbarButtonId(id)) return true;
  return map?.[id] !== false;
}

/** 只留下显式隐藏的按钮，方便写进设置。 */
export function compactHiddenToolbarButtons(
  map: Partial<Record<ToolbarButtonId, boolean>>
): Partial<Record<ToolbarButtonId, boolean>> {
  const out: Partial<Record<ToolbarButtonId, boolean>> = {};
  for (const id of TOOLBAR_BUTTON_IDS) {
    if (map[id] === false) out[id] = false;
  }
  return out;
}
