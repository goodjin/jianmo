/**
 * M59：大表格编辑性能——按 Markdown 源文估计表格体量，决定是否加载列宽拖拽等高开销能力。
 * 阈值与 `markly-table-rich.ts` 中粘贴「软确认」常量对齐，改动时请两边同步。
 */
export const RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_ROWS = 18;
export const RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS = 10;
export const RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_CELLS = 200;

export type RichTableColumnResizeMode = 'auto' | 'on' | 'off';

function countCellsInGfmTableLine(line: string): number {
  const t = line.trimEnd();
  if (!t.startsWith('|')) return 0;
  const parts = t.split('|');
  if (parts.length < 3) return 0;
  return parts.length - 2;
}

/**
 * 从 Markdown 扫描「以 | 开头的连续行」，视为表格块（与 GFM 接近，用于量级估计而非解析）。
 */
export function estimateMarkdownTableBlocksStats(markdown: string): {
  hasTable: boolean;
  maxRows: number;
  maxCols: number;
  maxCells: number;
} {
  const lines = markdown.split('\n');
  let cur: string[] = [];
  let maxRows = 0;
  let maxCols = 0;
  let maxCells = 0;

  const flush = (): void => {
    if (cur.length < 1) return;
    const cols = Math.max(1, ...cur.map(countCellsInGfmTableLine));
    const rows = cur.length;
    const cells = rows * cols;
    maxRows = Math.max(maxRows, rows);
    maxCols = Math.max(maxCols, cols);
    maxCells = Math.max(maxCells, cells);
    cur = [];
  };

  for (const line of lines) {
    if (/^\s*\|/.test(line)) cur.push(line);
    else flush();
  }
  flush();

  return {
    hasTable: maxCells > 0,
    maxRows,
    maxCols,
    maxCells,
  };
}

export function computeRichTableColumnResizeEnabled(
  mode: RichTableColumnResizeMode | undefined,
  markdown: string
): boolean {
  const m = mode ?? 'auto';
  if (m === 'off') return false;
  if (m === 'on') return true;
  const s = estimateMarkdownTableBlocksStats(markdown);
  if (!s.hasTable) return true;
  if (s.maxCells >= RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_CELLS) return false;
  if (s.maxRows >= RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_ROWS) return false;
  if (s.maxCols >= RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS) return false;
  return true;
}
