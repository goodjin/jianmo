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

function enforcePasteGridLimits(rows: string[][]): { grid: string[][] | null; reason: 'empty' | 'over_limit' | null } {
  if (rows.length === 0) return { grid: null, reason: 'empty' };
  const h = rows.length;
  const w = Math.max(1, ...rows.map((r) => r.length));
  if (h > MARKLY_TABLE_PASTE_MAX_ROWS || w > MARKLY_TABLE_PASTE_MAX_COLS) return { grid: null, reason: 'over_limit' };
  if (h * w > MARKLY_TABLE_PASTE_MAX_CELLS) return { grid: null, reason: 'over_limit' };
  return { grid: rows, reason: null };
}

/** B1：表格内粘贴优先尝试 HTML table（Excel/网页复制），失败再回退到 plain TSV/CSV */
export function parseHtmlTableToGrid(
  html: string
): { grid: string[][] | null; reason: 'no_table' | 'unsupported_merge' | 'over_limit' | 'invalid' | null } {
  const raw = (html ?? '').trim();
  if (!raw) return { grid: null, reason: 'no_table' };

  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return { grid: null, reason: 'no_table' };

    const grid: string[][] = [];
    const spans = new Map<string, { remaining: number; text: string }>();
    const key = (r: number, c: number) => `${r}:${c}`;

    const normalizeCellText = (cell: Element) =>
      (cell.textContent || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    const parseSpan = (v: string | null) => {
      if (!v) return 1;
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    };

    const trs = Array.from(table.querySelectorAll('tr'));
    let r = 0;
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('th,td'));
      if (cells.length === 0) continue;

      if (!grid[r]) grid[r] = [];
      let c = 0;

      const fillSpanHoles = () => {
        while (true) {
          const s = spans.get(key(r, c));
          if (!s) return;
          grid[r]![c] = '';
          s.remaining -= 1;
          if (s.remaining <= 0) spans.delete(key(r, c));
          else spans.set(key(r + 1, c), { remaining: s.remaining, text: s.text });
          c += 1;
        }
      };

      for (const cell of cells) {
        fillSpanHoles();

        const rowspan = parseSpan(cell.getAttribute('rowspan'));
        const colspan = parseSpan(cell.getAttribute('colspan'));
        const text = normalizeCellText(cell);

        // place anchor cell
        grid[r]![c] = text;

        // colspan: fill horizontally with empty cells
        for (let k = 1; k < colspan; k++) {
          grid[r]![c + k] = '';
        }

        // rowspan: mark cells below as spanned holes (also spanning colspan width)
        if (rowspan > 1) {
          for (let rr = r + 1; rr < r + rowspan; rr++) {
            for (let cc = c; cc < c + colspan; cc++) {
              spans.set(key(rr, cc), { remaining: 1, text });
            }
          }
        }

        c += colspan;
      }
      fillSpanHoles();
      r += 1;
    }

    const rows = grid.filter((row) => row && row.length > 0);
    if (rows.length === 0) return { grid: null, reason: 'invalid' };
    const w = Math.max(1, ...rows.map((r2) => r2.length));
    if (w < 2) return { grid: null, reason: 'invalid' };
    const rect = rows.map((rr) => {
      if (rr.length >= w) return rr;
      const next = rr.slice();
      while (next.length < w) next.push('');
      return next;
    });

    const limited = enforcePasteGridLimits(rect);
    return limited.grid ? { grid: limited.grid, reason: null } : { grid: null, reason: limited.reason === 'over_limit' ? 'over_limit' : 'invalid' };
  } catch {
    return { grid: null, reason: 'invalid' };
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
    if (!rect) return null;
    return enforcePasteGridLimits(rect).grid;
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
    return enforcePasteGridLimits(parsed).grid;
  }

  if (text.includes(',')) {
    const row = parseCsvLineStrict(text);
    if (row && row.length >= 2) return enforcePasteGridLimits([row]).grid;
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

function emitTablePasteToast(message: string) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('markly:toast', { detail: { message, kind: 'warn' } }));
    }
  } catch {
    // ignore
  }
}

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
          const htmlRes = parseHtmlTableToGrid(html);
          const grid = htmlRes.grid ?? parseDelimitedGridForTablePaste(plain);
          if (!grid && htmlRes.reason === 'over_limit') {
            emitTablePasteToast(
              `粘贴表格过大，已拒绝（上限：${MARKLY_TABLE_PASTE_MAX_ROWS} 行 / ${MARKLY_TABLE_PASTE_MAX_COLS} 列 / ${MARKLY_TABLE_PASTE_MAX_CELLS} 格）。`
            );
          }
          if (!grid && plain) {
            // plain 存在但解析失败：多半是坏 CSV/非矩阵；给出轻提示避免“没反应”
            emitTablePasteToast('未识别为矩阵数据（TSV/CSV），已按普通文本粘贴。');
          }
          if (!grid) return false;
          const built = gridToRowsSlice(view.state.schema, grid, { preferHeaderCells });
          if (!built) return false;
          return pmTableHandlePaste(view, event, built);
        },
      },
      view(view) {
        const handler = (e: Event) => {
          const ce = e as CustomEvent;
          const detail = (ce?.detail ?? {}) as { plain?: string; html?: string };
          const html = detail.html ?? '';
          const plain = detail.plain ?? '';
          const htmlRes = parseHtmlTableToGrid(html);
          const grid = htmlRes.grid ?? parseDelimitedGridForTablePaste(plain);
          if (!grid) return;
          const built = gridToRowsSlice(view.state.schema, grid, { preferHeaderCells: false });
          if (!built) return;
          pmTableHandlePaste(
            view,
            // 最小 fake event：只要求 clipboardData.getData 被访问时可用；pmTableHandlePaste 主要看 slice/selection
            ({ clipboardData: { getData: () => '' } } as unknown) as ClipboardEvent,
            built
          );
        };
        window.addEventListener('markly:simulateTablePaste' as any, handler as any);
        return {
          destroy() {
            window.removeEventListener('markly:simulateTablePaste' as any, handler as any);
          },
        };
      },
    })
);
