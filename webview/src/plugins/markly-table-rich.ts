import { $prose } from '@milkdown/utils';
import { Fragment, Slice, type Node as ProseNode, type Schema } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { keymap } from 'prosemirror-keymap';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  deleteColumn,
  deleteRow,
  handlePaste as pmTableHandlePaste,
  isInTable,
  selectedRect,
  tableNodeTypes,
  TableMap,
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

export type MarklyTablePasteMatrixParseSource = 'html' | 'plain' | null;
export type MarklyTablePasteMatrixParseReason = 'no_table' | 'invalid' | 'over_limit' | 'not_grid' | null;
export type MarklyTablePasteMatrixParseResult = {
  grid: string[][] | null;
  source: MarklyTablePasteMatrixParseSource;
  reason: MarklyTablePasteMatrixParseReason;
  /**
   * HTML 侧更细的失败信息（即使最终回退到 plain，也保留）
   * - htmlCandidate: 剪贴板看起来像 table（含 <table> 或确实解析到了 table）
   */
  htmlReason: 'no_table' | 'unsupported_merge' | 'over_limit' | 'invalid' | null;
  htmlCandidate: boolean;
  /** plain 侧更细的失败信息（即使最终优先了 html，也保留） */
  plainReason: 'not_grid' | 'over_limit' | null;
  /**
   * plain 侧“表格候选”启发式：含 tab 或者看起来像多行 CSV
   * 用于在不拦截的情况下给轻 toast，避免“没反应”
   */
  plainCandidate: boolean;
};

export type MarklyTableSelectionFillMode = 'exact' | 'broadcast' | 'repeatRow' | 'repeatCol' | 'reject';
export type MarklyTableSelectionFillMapping =
  | { mode: 'exact' }
  | { mode: 'broadcast' }
  | { mode: 'repeatRow'; repeatRowStride: number }
  | { mode: 'repeatCol'; repeatColStride: number }
  | { mode: 'reject' };

/**
 * N3-1：表格内选区填充粘贴——“grid 如何映射到选区”的规则契约（纯函数）
 * 输入：gridHeight/gridWidth + selHeight/selWidth
 * 输出：mode + 必要派生信息（repeat 步长）
 */
export function decideTableGridSelectionFillMapping(args: {
  gridHeight: number;
  gridWidth: number;
  selHeight: number;
  selWidth: number;
}): MarklyTableSelectionFillMapping {
  const { gridHeight, gridWidth, selHeight, selWidth } = args;

  const isPosInt = (n: number) => Number.isFinite(n) && Number.isInteger(n) && n > 0;
  if (![gridHeight, gridWidth, selHeight, selWidth].every(isPosInt)) return { mode: 'reject' };

  // 1) exact：grid 与选区尺寸完全一致
  if (gridHeight === selHeight && gridWidth === selWidth) return { mode: 'exact' };

  // 2) broadcast：grid 为 1x1，填充整个选区
  if (gridHeight === 1 && gridWidth === 1) return { mode: 'broadcast' };

  // 3) repeatRow：grid 为 1xW 且 W==selW，重复填充 selH 行
  if (gridHeight === 1 && gridWidth === selWidth) return { mode: 'repeatRow', repeatRowStride: 1 };

  // 4) repeatCol：grid 为 Hx1 且 H==selH，重复填充 selW 列
  if (gridWidth === 1 && gridHeight === selHeight) return { mode: 'repeatCol', repeatColStride: 1 };

  // 5) 其他一律 reject
  return { mode: 'reject' };
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

function parseDelimitedGridForTablePasteDetailedInternal(raw: string): {
  grid: string[][] | null;
  reason: 'not_grid' | 'over_limit' | null;
} {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  if (!text.trim()) return { grid: null, reason: 'not_grid' };

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
    if (lines.length === 0) return { grid: null, reason: 'not_grid' };
    const rows = lines.map((ln) => ln.split('\t').map((c) => c.trim()));
    const rect = padRect(rows);
    if (!rect) return { grid: null, reason: 'not_grid' };
    const limited = enforcePasteGridLimits(rect);
    return limited.grid ? { grid: limited.grid, reason: null } : { grid: null, reason: limited.reason === 'over_limit' ? 'over_limit' : 'not_grid' };
  }

  if (text.includes('\n')) {
    const lines = dropTrailingEmpty(text.split('\n').map((l) => l.trimEnd()));
    if (lines.length === 0) return { grid: null, reason: 'not_grid' };
    // 多行但不含 Tab：采用严格 CSV（零依赖）。任意一行解析失败或列数不一致，则不当作矩阵（避免误伤普通段落/坏 CSV）
    const parsed: string[][] = [];
    for (const ln of lines) {
      const row = parseCsvLineStrict(ln);
      if (!row || row.length < 2) return { grid: null, reason: 'not_grid' };
      parsed.push(row);
    }
    const w = parsed[0]!.length;
    if (w < 2) return { grid: null, reason: 'not_grid' };
    if (!parsed.every((r) => r.length === w)) return { grid: null, reason: 'not_grid' };
    const limited = enforcePasteGridLimits(parsed);
    return limited.grid ? { grid: limited.grid, reason: null } : { grid: null, reason: limited.reason === 'over_limit' ? 'over_limit' : 'not_grid' };
  }

  if (text.includes(',')) {
    const row = parseCsvLineStrict(text);
    if (row && row.length >= 2) {
      const limited = enforcePasteGridLimits([row]);
      return limited.grid ? { grid: limited.grid, reason: null } : { grid: null, reason: limited.reason === 'over_limit' ? 'over_limit' : 'not_grid' };
    }
  }

  return { grid: null, reason: 'not_grid' };
}

/** 供单测：把剪贴板纯文本解析成矩形网格；无法构成矩阵则返回 null（避免误伤普通粘贴） */
export function parseDelimitedGridForTablePaste(raw: string): string[][] | null {
  return parseDelimitedGridForTablePasteDetailedInternal(raw).grid;
}

/** N2-1：表格外粘贴（Rich）统一矩阵解析入口：HTML table 优先，其次 plain TSV/CSV */
export function parseTablePasteMatrix(html: string, plain: string): MarklyTablePasteMatrixParseResult {
  const htmlRes = parseHtmlTableToGrid(html);
  const htmlLooksLikeTable = /<table[\s>]/i.test(html ?? '');
  const htmlCandidate = htmlLooksLikeTable || htmlRes.reason !== 'no_table';
  if (htmlRes.grid)
    return {
      grid: htmlRes.grid,
      source: 'html',
      reason: null,
      htmlReason: null,
      htmlCandidate,
      plainReason: null,
      plainCandidate: false,
    };
  if (htmlRes.reason === 'over_limit')
    return {
      grid: null,
      source: 'html',
      reason: 'over_limit',
      htmlReason: 'over_limit',
      htmlCandidate,
      plainReason: null,
      plainCandidate: false,
    };

  const plainRes = parseDelimitedGridForTablePasteDetailedInternal(plain);
  const plainText = plain ?? '';
  const plainCandidate = plainText.includes('\t') || (plainText.includes(',') && plainText.includes('\n'));
  if (plainRes.grid)
    return {
      grid: plainRes.grid,
      source: 'plain',
      reason: null,
      htmlReason: htmlRes.reason,
      htmlCandidate,
      plainReason: null,
      plainCandidate,
    };

  const reason: MarklyTablePasteMatrixParseReason =
    plainRes.reason === 'over_limit'
      ? 'over_limit'
      : htmlCandidate && htmlRes.reason === 'invalid'
        ? 'invalid'
        : htmlRes.reason === 'no_table'
          ? 'not_grid'
          : (plainRes.reason ?? 'not_grid');

  const source: MarklyTablePasteMatrixParseSource =
    reason === 'invalid' || (htmlCandidate && htmlRes.reason === 'invalid') ? 'html' : 'plain';

  return {
    grid: null,
    source,
    reason,
    htmlReason: htmlRes.reason,
    htmlCandidate,
    plainReason: plainRes.reason,
    plainCandidate,
  };
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

function gridToTableNode(schema: Schema, grid: string[][]): ProseNode | null {
  const types = tableNodeTypes(schema);
  const paragraph = schema.nodes.paragraph;
  if (!paragraph || !types.table || !types.row || !types.cell) return null;
  const headerCellType = ((types as any).header_cell as typeof types.cell | undefined) ?? types.cell;

  try {
    const rowNodes = grid.map((cells, r) =>
      types.row.create(
        null,
        Fragment.from(
          cells.map((cellText) => {
            const para = cellText ? paragraph.create(null, Fragment.from(schema.text(cellText))) : paragraph.create();
            const cellType = r === 0 ? headerCellType : types.cell;
            const filled = cellType.createAndFill(null, Fragment.from(para));
            if (!filled) throw new Error('cell createAndFill failed');
            return filled;
          })
        )
      )
    );

    const table = types.table.createAndFill(null, Fragment.from(rowNodes));
    return table ?? null;
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

function cellTextAt(grid: string[][], r: number, c: number): string {
  const row = grid[r];
  if (!row) return '';
  const v = row[c];
  return typeof v === 'string' ? v : '';
}

function buildCellParagraph(schema: Schema, text: string) {
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return null;
  const t = (text ?? '').toString();
  return t ? paragraph.create(null, Fragment.from(schema.text(t))) : paragraph.create();
}

function fillCellSelectionWithoutExpandingTable(args: {
  view: any;
  grid: string[][];
  mapping: MarklyTableSelectionFillMapping;
}): boolean {
  const { view, grid, mapping } = args;
  const { state } = view;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) return false;

  const schema = state.schema;
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return false;

  const rect = selectedRect(state);
  const table = state.doc.nodeAt(rect.tableStart - 1);
  if (!table) return false;

  const map = TableMap.get(table);
  const selHeight = rect.bottom - rect.top;
  const selWidth = rect.right - rect.left;
  if (selHeight <= 0 || selWidth <= 0) return false;

  const resolveValue = (r: number, c: number): string => {
    switch (mapping.mode) {
      case 'exact':
        return cellTextAt(grid, r, c);
      case 'broadcast':
        return cellTextAt(grid, 0, 0);
      case 'repeatRow':
        return cellTextAt(grid, 0, c);
      case 'repeatCol':
        return cellTextAt(grid, r, 0);
      default:
        return '';
    }
  };

  let tr = state.tr;
  for (let r = 0; r < selHeight; r++) {
    for (let c = 0; c < selWidth; c++) {
      const row = rect.top + r;
      const col = rect.left + c;
      const cellOffset = map.map[row * map.width + col];
      if (cellOffset == null) continue;
      const cellPos = rect.tableStart + cellOffset;
      const cellNode = tr.doc.nodeAt(cellPos);
      if (!cellNode) continue;

      const nextText = resolveValue(r, c);
      const para = buildCellParagraph(schema, nextText);
      if (!para) continue;

      // 只替换 cell 内部内容（paragraph*），不替换 cell 节点本身，避免触发表格结构变化
      tr = tr.replaceWith(cellPos + 1, cellPos + cellNode.nodeSize - 1, Fragment.from(para));
    }
  }

  if (!tr.docChanged) return false;
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** TSV / 简单 CSV → 交给 prosemirror-tables 的 insertCells 逻辑 */
export function createMarklyTableGridPastePlugin(): Plugin {
  return new Plugin({
    key: marklyTableGridPasteKey,
    priority: 1000,
    props: {
      handlePaste(view, event, _slice) {
        const html = event.clipboardData?.getData('text/html') ?? '';
        const plain = event.clipboardData?.getData('text/plain') ?? '';

        // N2-2：Rich + selection 不在表格内，且能解析到矩阵 grid：自动建表并填充
        if (!isInTable(view.state)) {
          if (!(view.state.selection instanceof TextSelection)) return false;
          const parsed = parseTablePasteMatrix(html, plain);
          if (!parsed.grid && parsed.reason === 'over_limit') {
            emitTablePasteToast(
              `粘贴表格过大，已拒绝（上限：${MARKLY_TABLE_PASTE_MAX_ROWS} 行 / ${MARKLY_TABLE_PASTE_MAX_COLS} 列 / ${MARKLY_TABLE_PASTE_MAX_CELLS} 格）。`
            );
            return true; // 拦截：避免把超大 table/plain 原样粘贴进文档导致卡顿
          }
          if (!parsed.grid) {
            // N2-3：不拦截（交给默认粘贴），但如果“看起来像表格”却无法建表，给轻 toast 避免“没反应”
            const shouldHint =
              (parsed.htmlCandidate && parsed.htmlReason === 'invalid') ||
              (parsed.plainCandidate && parsed.plainReason === 'not_grid');
            if (shouldHint) emitTablePasteToast('未能解析为表格矩阵，已按普通粘贴处理。');
            return false; // not_grid/invalid/no_table：不拦截
          }

          const table = gridToTableNode(view.state.schema, parsed.grid);
          if (!table) return false;
          const tr = view.state.tr.replaceSelectionWith(table).scrollIntoView();
          view.dispatch(tr);
          return true;
        }

        // N3-2：表格内且为 CellSelection 时，执行“填充粘贴”（不扩展表格结构）
        if (view.state.selection instanceof CellSelection) {
          const parsed = parseTablePasteMatrix(html, plain);
          if (!parsed.grid && parsed.reason === 'over_limit') {
            emitTablePasteToast(
              `粘贴表格过大，已拒绝（上限：${MARKLY_TABLE_PASTE_MAX_ROWS} 行 / ${MARKLY_TABLE_PASTE_MAX_COLS} 列 / ${MARKLY_TABLE_PASTE_MAX_CELLS} 格）。`
            );
            return true; // 拦截：避免超大矩阵触发默认粘贴/扩表/卡顿
          }
          const normPlain = (plain ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const grid =
            parsed.grid ??
            // 单列多行（常见于复制一列数据）：在 CellSelection 场景下将其视为 Hx1，允许 repeatCol（不扩展表格）
            (() => {
              if (!normPlain.trim()) return null;
              if (normPlain.includes('\t')) return null; // TSV/矩阵应由 parseTablePasteMatrix 处理
              if (normPlain.includes(',')) return null; // CSV/矩阵应由 parseTablePasteMatrix 处理
              if (!normPlain.includes('\n')) return null;
              const lines = normPlain.split('\n');
              while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
              if (lines.length <= 1) return null;
              return lines.map((ln) => [(ln ?? '').trim()]);
            })() ??
            // 单值粘贴（常见于复制单个 Excel 单元格/短文本）：在 CellSelection 场景下将其视为 1x1，走 broadcast 填充
            (normPlain.trim() && !normPlain.includes('\n') && !normPlain.includes('\t')
              ? [[normPlain.trim()]]
              : null);
          if (!grid) return false; // 仍解析不出：不拦截，保持默认粘贴行为

          const sel = view.state.selection;
          const rect = selectedRect(view.state);
          const selHeight = rect.bottom - rect.top;
          const selWidth = rect.right - rect.left;
          const mapping = decideTableGridSelectionFillMapping({
            gridHeight: grid.length,
            gridWidth: Math.max(1, ...grid.map((r) => r.length)),
            selHeight,
            selWidth,
          });

          if (mapping.mode === 'reject') {
            // 对 CellSelection：reject 意味着“不能在不改结构的前提下完成填充”。
            // 这里选择拦截（return true），避免走 insertCells 导致扩表，违反 N3-2 约束。
            emitTablePasteToast('粘贴矩阵与选区尺寸不匹配，已取消填充（不会扩展表格）。');
            return true;
          }

          const handled = fillCellSelectionWithoutExpandingTable({ view, grid, mapping });
          return handled;
        }

        // 既有逻辑：表格内粘贴 → 交给 prosemirror-tables 的 insertCells
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

        const parsed = parseTablePasteMatrix(html, plain);
        const grid = parsed.grid;
        if (!grid && parsed.reason === 'over_limit') {
          emitTablePasteToast(
            `粘贴表格过大，已拒绝（上限：${MARKLY_TABLE_PASTE_MAX_ROWS} 行 / ${MARKLY_TABLE_PASTE_MAX_COLS} 列 / ${MARKLY_TABLE_PASTE_MAX_CELLS} 格）。`
          );
          return true; // 拦截：避免把超大 table/plain 原样粘贴进文档导致卡顿
        }
        if (!grid && plain && parsed.source === 'plain' && parsed.reason === 'not_grid') {
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
        const fakeEvt = ({
          clipboardData: {
            getData: (t: string) => (t === 'text/html' ? html : t === 'text/plain' ? plain : ''),
          },
        } as unknown) as ClipboardEvent;

        // 复用真实粘贴链路（props.handlePaste），确保“表格外自动建表 / 表格内填充”等逻辑一致
        view.someProp('handlePaste', (f: any) => f(view, fakeEvt, Slice.empty));
      };
      window.addEventListener('markly:simulateTablePaste' as any, handler as any);
      return {
        destroy() {
          window.removeEventListener('markly:simulateTablePaste' as any, handler as any);
        },
      };
    },
  });
}

export const marklyTableGridPastePlugin = $prose(() => createMarklyTableGridPastePlugin());
