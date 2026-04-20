import { $prose } from '@milkdown/utils';
import { Fragment, Slice, type Schema } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { keymap } from 'prosemirror-keymap';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  handlePaste as pmTableHandlePaste,
  isInTable,
  tableNodeTypes,
} from 'prosemirror-tables';

/** 粘贴矩阵上限（防止超大表格卡死 webview） */
export const MARKLY_TABLE_PASTE_MAX_ROWS = 80;
export const MARKLY_TABLE_PASTE_MAX_COLS = 40;
export const MARKLY_TABLE_PASTE_MAX_CELLS = 800;

function enforcePasteGridLimits(rows: string[][]): string[][] | null {
  if (rows.length === 0) return null;
  const h = rows.length;
  const w = Math.max(1, ...rows.map((r) => r.length));
  if (h > MARKLY_TABLE_PASTE_MAX_ROWS || w > MARKLY_TABLE_PASTE_MAX_COLS) return null;
  if (h * w > MARKLY_TABLE_PASTE_MAX_CELLS) return null;
  return rows;
}

/** B1：表格内粘贴优先尝试 HTML table（Excel/网页复制），失败再回退到 plain TSV/CSV */
export function parseHtmlTableToGrid(html: string): string[][] | null {
  const raw = (html ?? '').trim();
  if (!raw) return null;

  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const rows: string[][] = [];
    for (const tr of Array.from(table.querySelectorAll('tr'))) {
      const cells = Array.from(tr.querySelectorAll('th,td'));
      if (cells.length === 0) continue;

      const row: string[] = [];
      for (const cell of cells) {
        const rs = cell.getAttribute('rowspan');
        const cs = cell.getAttribute('colspan');
        // 合并单元格暂不支持：避免错误展开导致内容错位
        if ((rs && rs !== '1') || (cs && cs !== '1')) return null;
        const text = (cell.textContent || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        row.push(text.trim());
      }
      rows.push(row);
    }

    if (rows.length === 0) return null;
    const w = Math.max(1, ...rows.map((r) => r.length));
    if (w < 2) return null;
    const rect = rows.map((r) => {
      if (r.length >= w) return r;
      const next = r.slice();
      while (next.length < w) next.push('');
      return next;
    });
    return enforcePasteGridLimits(rect);
  } catch {
    return null;
  }
}

/** 供单测：把剪贴板纯文本解析成矩形网格；无法构成矩阵则返回 null（避免误伤普通粘贴） */
export function parseDelimitedGridForTablePaste(raw: string): string[][] | null {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  if (!text.trim()) return null;

  const dropTrailingEmpty = (lines: string[]) => {
    const out = lines.slice();
    while (out.length && out[out.length - 1]!.trim() === '') out.pop();
    return out;
  };

  const padRect = (rows: string[][]): string[][] | null => {
    if (rows.length === 0) return null;
    const w = Math.max(1, ...rows.map((r) => r.length));
    return rows.map((r) => {
      if (r.length >= w) return r;
      const next = r.slice();
      while (next.length < w) next.push('');
      return next;
    });
  };

  if (text.includes('\t')) {
    const lines = dropTrailingEmpty(text.split('\n'));
    if (lines.length === 0) return null;
    const rows = lines.map((ln) => ln.split('\t').map((c) => c.trim()));
    const rect = padRect(rows);
    return rect ? enforcePasteGridLimits(rect) : null;
  }

  if (text.includes('\n')) {
    const lines = dropTrailingEmpty(text.split('\n').map((l) => l.trimEnd()));
    if (lines.length === 0) return null;
    // 多行但不含 Tab：采用严格 CSV（零依赖）。任意一行解析失败或列数不一致，则不当作矩阵（避免误伤普通段落/坏 CSV）
    const parsed: string[][] = [];
    for (const ln of lines) {
      const row = parseCsvLineStrict(ln);
      if (!row || row.length < 2) return null;
      parsed.push(row);
    }
    const w = parsed[0]!.length;
    if (w < 2) return null;
    if (!parsed.every((r) => r.length === w)) return null;
    return enforcePasteGridLimits(parsed);
  }

  if (text.includes(',')) {
    const row = parseCsvLineStrict(text);
    if (row && row.length >= 2) return enforcePasteGridLimits([row]);
  }

  return null;
}

/** 极简 CSV：支持引号字段，逗号分隔 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  const pushField = (s: string) => out.push(s.trim());

  while (i < line.length) {
    const ch = line[i]!;
    if (ch === '"') {
      let j = i + 1;
      let buf = '';
      while (j < line.length) {
        if (line[j] === '"') {
          if (line[j + 1] === '"') {
            buf += '"';
            j += 2;
            continue;
          }
          break;
        }
        buf += line[j]!;
        j++;
      }
      pushField(buf);
      i = j + 1;
      if (line[i] === ',') i++;
      continue;
    }

    let j = i;
    while (j < line.length && line[j] !== ',') j++;
    pushField(line.slice(i, j));
    i = j < line.length && line[j] === ',' ? j + 1 : j;
  }

  return out;
}

/**
 * B2：严格 CSV（零依赖）：
 * - 必须闭合引号
 * - 闭合引号后只能是逗号或行尾
 * - 支持尾随逗号（产出尾随空字段）
 */
export function parseCsvLineStrict(line: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  const pushField = (s: string, quoted: boolean) => out.push(quoted ? s : s.trim());

  while (i < line.length) {
    const ch = line[i]!;
    if (ch === '"') {
      let j = i + 1;
      let buf = '';
      while (j < line.length) {
        if (line[j] === '"') {
          if (line[j + 1] === '"') {
            buf += '"';
            j += 2;
            continue;
          }
          break;
        }
        buf += line[j]!;
        j++;
      }
      if (j >= line.length || line[j] !== '"') return null; // unclosed quote
      pushField(buf, true);
      i = j + 1;
      if (i === line.length) break;
      if (line[i] === ',') {
        i++;
        // 允许尾随逗号：稍后在行尾补空字段
        if (i === line.length) out.push('');
        continue;
      }
      return null; // junk after closing quote
    }

    let j = i;
    while (j < line.length && line[j] !== ',') j++;
    pushField(line.slice(i, j), false);
    if (j < line.length && line[j] === ',') {
      i = j + 1;
      if (i === line.length) out.push('');
    } else {
      i = j;
    }
  }

  return out;
}

function gridToRowsSlice(schema: Schema, grid: string[][], opts?: { preferHeaderCells?: boolean }): Slice | null {
  const types = tableNodeTypes(schema);
  const paragraph = schema.nodes.paragraph;
  if (!paragraph || !types.row || !types.cell) return null;
  const cellType = opts?.preferHeaderCells && (types as any).header_cell ? (types as any).header_cell : types.cell;

  try {
    const rowNodes = grid.map((cells) =>
      types.row.create(
        null,
        Fragment.from(
          cells.map((cellText) => {
            const para = cellText
              ? paragraph.create(null, Fragment.from(schema.text(cellText)))
              : paragraph.create();
            const filled = cellType.createAndFill(null, Fragment.from(para));
            if (!filled) throw new Error('cell createAndFill failed');
            return filled;
          })
        )
      )
    );
    return new Slice(Fragment.from(rowNodes), 0, 0);
  } catch {
    return null;
  }
}

/** Rich 表格结构编辑：在表格内 Mod+Alt+方向键增删行列（避免与 VS Code / 列表 Tab 冲突） */
export const marklyTableStructureKeymapPlugin = $prose(() =>
  keymap({
    'Mod-Alt-ArrowDown': (state, dispatch) => (isInTable(state) ? addRowAfter(state, dispatch) : false),
    'Mod-Alt-ArrowUp': (state, dispatch) => (isInTable(state) ? addRowBefore(state, dispatch) : false),
    'Mod-Alt-ArrowRight': (state, dispatch) => (isInTable(state) ? addColumnAfter(state, dispatch) : false),
    'Mod-Alt-ArrowLeft': (state, dispatch) => (isInTable(state) ? addColumnBefore(state, dispatch) : false),
    'Mod-Alt-Backspace': (state, dispatch) => (isInTable(state) ? deleteRow(state, dispatch) : false),
    'Mod-Alt-Shift-Backspace': (state, dispatch) => (isInTable(state) ? deleteColumn(state, dispatch) : false),
  })
);

const marklyTableGridPasteKey = new PluginKey('markly-table-grid-paste');

/** TSV / 简单 CSV → 交给 prosemirror-tables 的 insertCells 逻辑 */
export const marklyTableGridPastePlugin = $prose(
  () =>
    new Plugin({
      key: marklyTableGridPasteKey,
      priority: 1000,
      props: {
        handlePaste(view, event, _slice) {
          if (!isInTable(view.state)) return false;
          if (!(view.state.selection instanceof TextSelection)) return false;

          // B3：粘贴只填内容，但如果落点在 header 行，则保持 header cell 类型（避免把 header 变成普通 cell）
          let preferHeaderCells = false;
          try {
            const $from = view.state.selection.$from;
            for (let d = $from.depth; d > 0; d--) {
              const name = $from.node(d).type.name;
              if (name === 'table_header') {
                preferHeaderCells = true;
                break;
              }
              if (name === 'table_cell') break;
            }
          } catch {
            // ignore
          }

          const html = event.clipboardData?.getData('text/html') ?? '';
          const plain = event.clipboardData?.getData('text/plain') ?? '';
          const grid = parseHtmlTableToGrid(html) ?? parseDelimitedGridForTablePaste(plain);
          if (!grid) return false;
          const built = gridToRowsSlice(view.state.schema, grid, { preferHeaderCells });
          if (!built) return false;
          return pmTableHandlePaste(view, event, built);
        },
      },
    })
);
