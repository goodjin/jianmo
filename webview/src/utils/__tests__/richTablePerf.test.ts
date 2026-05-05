import { describe, it, expect } from 'vitest';
import {
  computeRichTableColumnResizeEnabled,
  estimateMarkdownTableBlocksStats,
  RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS,
  RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_CELLS,
} from '../richTablePerf';

describe('estimateMarkdownTableBlocksStats', () => {
  it('空文档无表', () => {
    expect(estimateMarkdownTableBlocksStats('')).toEqual({
      hasTable: false,
      maxRows: 0,
      maxCols: 0,
      maxCells: 0,
    });
  });

  it('单块小表：行/列/格数', () => {
    const md = `| a | b |
| - | - |
| 1 | 2 |
`;
    const s = estimateMarkdownTableBlocksStats(md);
    expect(s.hasTable).toBe(true);
    expect(s.maxRows).toBe(3);
    expect(s.maxCols).toBe(2);
    expect(s.maxCells).toBe(6);
  });

  it('段落分隔的两块表取最大块', () => {
    const md = `| x | y |
| - | - |
| 1 | 2 |

hello

| p | q | r |
| - | - | - |
| a | b | c |
`;
    const s = estimateMarkdownTableBlocksStats(md);
    expect(s.maxRows).toBe(3);
    expect(s.maxCols).toBe(3);
    expect(s.maxCells).toBe(9);
  });
});

describe('computeRichTableColumnResizeEnabled', () => {
  it('off 恒关', () => {
    const big = `|${' c |'.repeat(RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS + 1)}\n` + `|${' - |'.repeat(RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS + 1)}\n`;
    expect(computeRichTableColumnResizeEnabled('off', big)).toBe(false);
  });

  it('on 恒开', () => {
    const big = `|${' c |'.repeat(RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS + 1)}\n` + `|${' - |'.repeat(RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS + 1)}\n`;
    expect(computeRichTableColumnResizeEnabled('on', big)).toBe(true);
  });

  it('auto：无表时开', () => {
    expect(computeRichTableColumnResizeEnabled('auto', '# t\n\npara')).toBe(true);
  });

  it('auto：格数达上限关', () => {
    const cols = 10;
    const rowLine = (cells: string[]) => '| ' + cells.join(' | ') + ' |\n';
    const header = rowLine(Array(cols).fill('h'));
    const sep = rowLine(Array(cols).fill('---'));
    let body = '';
    for (let i = 0; i < 18; i++) body += rowLine(Array(cols).fill('x'));
    const md = header + sep + body;
    const s = estimateMarkdownTableBlocksStats(md);
    expect(s.maxRows).toBe(20);
    expect(s.maxCells).toBe(200);
    expect(s.maxCells).toBeGreaterThanOrEqual(RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_CELLS);
    expect(computeRichTableColumnResizeEnabled('auto', md)).toBe(false);
  });

  it('auto：仅超列数关', () => {
    const n = RICH_TABLE_COLUMN_RESIZE_AUTO_MAX_COLS + 1;
    const rowLine = (cells: string[]) => '| ' + cells.join(' | ') + ' |\n';
    const md =
      rowLine(Array(n).fill('c')) + rowLine(Array(n).fill('---')) + rowLine(Array(n).fill('v'));
    expect(estimateMarkdownTableBlocksStats(md).maxCols).toBe(n);
    expect(computeRichTableColumnResizeEnabled('auto', md)).toBe(false);
  });
});
