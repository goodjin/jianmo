import type { EditorView } from '@milkdown/prose/view';
import { TextSelection } from '@milkdown/prose/state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  deleteColumn,
  deleteRow,
  isInTable,
  mergeCells,
  selectedRect,
  splitCell,
  toggleHeaderRow,
  TableMap,
} from 'prosemirror-tables';
import { Fragment, type Node as PMNode } from '@milkdown/prose/model';
import { bandCoversEntireAxis, tableSelectionBand, type TableSelectionBand } from './tableEdgeUi';

export type RichTableOp =
  | 'addRowAfter'
  | 'addRowBefore'
  | 'addColAfter'
  | 'addColBefore'
  | 'deleteTable'
  | 'deleteRow'
  | 'deleteCol'
  | 'toggleHeaderRow'
  | 'mergeCells'
  | 'splitCell'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight';

function emitTableToast(message: string) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('markly:toast', { detail: { message, kind: 'warn' } }));
    }
  } catch {
    // ignore
  }
}

function extractPureTextFromCell(cell: any): { ok: true; text: string } | { ok: false } {
  if (!cell) return { ok: false };

  // 仅允许：cell -> paragraph+ -> text*，且不允许 marks
  const texts: string[] = [];
  for (let i = 0; i < cell.childCount; i++) {
    const block = cell.child(i);
    if (block.type?.name !== 'paragraph') return { ok: false };

    let buf = '';
    for (let j = 0; j < block.childCount; j++) {
      const inline = block.child(j);
      if (inline.type?.name !== 'text') return { ok: false };
      if (inline.marks && inline.marks.length) return { ok: false };
      buf += inline.text ?? '';
    }
    const trimmed = buf.trim();
    if (trimmed) texts.push(trimmed);
  }
  return { ok: true, text: texts.join('\n') };
}

function prepareMergeCellsByJoiningText(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) {
    emitTableToast('当前选区不支持安全合并（仅支持规则的单元格选区）。');
    return false;
  }

  const rect = selectedRect(state);
  const table = state.doc.nodeAt(rect.tableStart - 1);
  if (!table) {
    emitTableToast('未找到表格结构，无法合并。');
    return false;
  }

  const map = TableMap.get(table);
  const schema = state.schema;
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) {
    emitTableToast('当前编辑器不支持段落节点，无法安全合并。');
    return false;
  }

  // 收集选区内所有“唯一 cell”的纯文本，按行优先拼接到 anchor cell
  const seen = new Set<number>();
  const collected: string[] = [];
  for (let r = rect.top; r < rect.bottom; r++) {
    for (let c = rect.left; c < rect.right; c++) {
      const cellOffset = map.map[r * map.width + c];
      if (cellOffset == null) continue;
      if (seen.has(cellOffset)) continue; // 跳过同一个（rowspan/colspan）映射到的重复格
      seen.add(cellOffset);

      const cellPos = rect.tableStart + cellOffset;
      const cell = state.doc.nodeAt(cellPos);
      const pure = extractPureTextFromCell(cell);
      if (!pure.ok) {
        emitTableToast('仅支持合并纯文本单元格（不含格式/复杂结构）。');
        return false;
      }
      if (pure.text) collected.push(pure.text);
    }
  }

  // anchor cell：以 selection anchor 为准
  const anchorCellPos = sel.$anchorCell.pos;
  const anchorCell = state.doc.nodeAt(anchorCellPos);
  if (!anchorCell) {
    emitTableToast('未找到锚点单元格，无法合并。');
    return false;
  }

  const joined = collected.join('\n');
  const nextPara = joined ? paragraph.create(null, Fragment.from(schema.text(joined))) : paragraph.create();

  // 只替换 anchor cell 内部内容，避免破坏表格结构/selection
  const tr = state.tr.replaceWith(anchorCellPos + 1, anchorCellPos + anchorCell.nodeSize - 1, Fragment.from(nextPara));
  if (tr.docChanged) view.dispatch(tr);
  return true;
}

function setColumnAlign(view: EditorView, align: 'left' | 'center' | 'right'): boolean {
  const { state } = view;
  const schema = state.schema;
  const cell = schema.nodes.table_cell;
  const header = (schema.nodes as any).table_header;
  const attrName = 'align';

  // schema may not support alignment attr; fail gracefully
  const canSet =
    (cell && (cell.spec as any)?.attrs && Object.prototype.hasOwnProperty.call((cell.spec as any).attrs, attrName)) ||
    (header && (header.spec as any)?.attrs && Object.prototype.hasOwnProperty.call((header.spec as any).attrs, attrName));
  if (!canSet) {
    emitTableToast('当前表格不支持列对齐设置。');
    return false;
  }

  try {
    const rect = selectedRect(state);
    const col = rect.left;
    let tr = state.tr;
    for (let row = rect.top; row < rect.bottom; row++) {
      const cellPos = rect.map.map[row * rect.map.width + col];
      const pos = rect.tableStart + cellPos;
      const node = tr.doc.nodeAt(pos);
      if (!node) continue;
      const nextAttrs = { ...(node.attrs || {}), [attrName]: align };
      tr = tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
    }
    if (tr.docChanged) {
      view.dispatch(tr);
      return true;
    }
    return false;
  } catch {
    emitTableToast('设置列对齐失败。');
    return false;
  }
}

function deleteCurrentTable(view: EditorView): boolean {
  const { state } = view;
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return false;

  let tableDepth: number | null = null;
  for (let depth = state.selection.$from.depth; depth > 0; depth--) {
    if (state.selection.$from.node(depth).type.name === 'table') {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth == null) return false;

  const tablePos = state.selection.$from.before(tableDepth);
  const table = state.selection.$from.node(tableDepth);
  const replacement = state.doc.childCount <= 1 ? Fragment.from(paragraph.create()) : Fragment.empty;
  const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, replacement).scrollIntoView();
  if (!tr.docChanged) return false;
  view.dispatch(tr);
  emitTableToast('已删除当前表格。');
  return true;
}

function isTableNode(node: PMNode | null | undefined): node is PMNode {
  if (!node) return false;
  const role = (node.type.spec as { tableRole?: string }).tableRole;
  return role === 'table' || node.type.name === 'table';
}

function tableNodeAt(doc: PMNode, tablePos: number): PMNode | null {
  const table = doc.nodeAt(tablePos);
  return isTableNode(table) ? table : null;
}

/** 单元格节点起点。与编辑器里已有的 CellSelection 位置算法一致。 */
function cellNodePos(tablePos: number, table: PMNode, row: number, col: number): number {
  const map = TableMap.get(table);
  const r = Math.max(0, Math.min(row, map.height - 1));
  const c = Math.max(0, Math.min(col, map.width - 1));
  return tablePos + 1 + map.positionAt(r, c, table);
}

function selectSingleCell(view: EditorView, tablePos: number, table: PMNode, row: number, col: number): boolean {
  const pos = cellNodePos(tablePos, table, row, col);
  try {
    const sel = TextSelection.create(view.state.doc, pos + 2);
    view.dispatch(view.state.tr.setSelection(sel));
    return true;
  } catch {
    return false;
  }
}

function selectCellRect(
  view: EditorView,
  tablePos: number,
  table: PMNode,
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number
): boolean {
  const anchor = cellNodePos(tablePos, table, rowStart, colStart);
  const head = cellNodePos(tablePos, table, rowEnd, colEnd);
  try {
    const next = new CellSelection(view.state.doc.resolve(anchor), view.state.doc.resolve(head));
    view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
    return true;
  } catch {
    return false;
  }
}

/** 当前选区如果盖住整行或整列，返回这段范围。普通光标或局部选格返回 null。 */
export function readTableAxisSelection(state: EditorView['state']): TableSelectionBand | null {
  if (!(state.selection instanceof CellSelection)) return null;
  try {
    const rect = selectedRect(state);
    return tableSelectionBand({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      mapWidth: rect.map.width,
      mapHeight: rect.map.height,
    });
  } catch {
    return null;
  }
}

export function selectTableRows(view: EditorView, tablePos: number, fromRow: number, toRow: number): boolean {
  const table = tableNodeAt(view.state.doc, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const a = Math.max(0, Math.min(fromRow, toRow, map.height - 1));
  const b = Math.min(map.height - 1, Math.max(fromRow, toRow, 0));
  return selectCellRect(view, tablePos, table, a, 0, b, map.width - 1);
}

export function selectTableColumns(view: EditorView, tablePos: number, fromCol: number, toCol: number): boolean {
  const table = tableNodeAt(view.state.doc, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const a = Math.max(0, Math.min(fromCol, toCol, map.width - 1));
  const b = Math.min(map.width - 1, Math.max(fromCol, toCol, 0));
  return selectCellRect(view, tablePos, table, 0, a, map.height - 1, b);
}

/**
 * 在第 gap 条水平交界插入一行。
 * 0 表示第一行之前，rowCount 表示最后一行之后，其余表示两行之间。
 */
export function insertTableRowAtGap(view: EditorView, tablePos: number, gap: number): boolean {
  const table = tableNodeAt(view.state.doc, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const g = Math.max(0, Math.min(Math.floor(gap), map.height));
  if (g === 0) {
    if (!selectSingleCell(view, tablePos, table, 0, 0)) return false;
    return addRowBefore(view.state, view.dispatch);
  }
  if (!selectSingleCell(view, tablePos, table, g - 1, 0)) return false;
  return addRowAfter(view.state, view.dispatch);
}

/** 在第 gap 条垂直交界插入一列。0 为最左之前，colCount 为最右之后。 */
export function insertTableColumnAtGap(view: EditorView, tablePos: number, gap: number): boolean {
  const table = tableNodeAt(view.state.doc, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  const g = Math.max(0, Math.min(Math.floor(gap), map.width));
  if (g === 0) {
    if (!selectSingleCell(view, tablePos, table, 0, 0)) return false;
    return addColumnBefore(view.state, view.dispatch);
  }
  if (!selectSingleCell(view, tablePos, table, 0, g - 1)) return false;
  return addColumnAfter(view.state, view.dispatch);
}

/**
 * 删掉当前整行或整列选区。
 * 多行多列一次删掉。选区盖住全部行或全部列时，删掉整张表（表内删光行/列没有意义）。
 */
export function deleteTableAxisSelection(view: EditorView): boolean {
  if (!isInTable(view.state)) return false;
  const band = readTableAxisSelection(view.state);
  if (!band) return false;
  let rect: ReturnType<typeof selectedRect>;
  try {
    rect = selectedRect(view.state);
  } catch {
    return false;
  }
  if (bandCoversEntireAxis(band, rect.map.width, rect.map.height)) {
    return deleteCurrentTable(view);
  }
  if (band.axis === 'row') return deleteRow(view.state, view.dispatch);
  return deleteColumn(view.state, view.dispatch);
}

export function runRichTableOp(view: EditorView, op: RichTableOp): boolean {
  if (!isInTable(view.state)) return false;
  switch (op) {
    case 'addRowAfter':
      return addRowAfter(view.state, view.dispatch);
    case 'addRowBefore':
      return addRowBefore(view.state, view.dispatch);
    case 'addColAfter':
      return addColumnAfter(view.state, view.dispatch);
    case 'addColBefore':
      return addColumnBefore(view.state, view.dispatch);
    case 'deleteRow':
      return deleteRow(view.state, view.dispatch);
    case 'deleteCol':
      return deleteColumn(view.state, view.dispatch);
    case 'deleteTable':
      return deleteCurrentTable(view);
    case 'toggleHeaderRow':
      return toggleHeaderRow(view.state, view.dispatch);
    case 'mergeCells': {
      try {
        const prepared = prepareMergeCellsByJoiningText(view);
        if (!prepared) return false;

        const ok = mergeCells(view.state, view.dispatch);
        if (!ok) emitTableToast('合并单元格失败。');
        return ok;
      } catch {
        emitTableToast('合并单元格失败。');
        return false;
      }
    }
    case 'splitCell': {
      try {
        const ok = splitCell(view.state, view.dispatch);
        if (!ok) emitTableToast('拆分单元格失败。');
        return ok;
      } catch {
        emitTableToast('拆分单元格失败。');
        return false;
      }
    }
    case 'alignLeft':
      return setColumnAlign(view, 'left');
    case 'alignCenter':
      return setColumnAlign(view, 'center');
    case 'alignRight':
      return setColumnAlign(view, 'right');
    default:
      return false;
  }
}
