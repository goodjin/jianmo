import type { EditorView } from '@milkdown/prose/view';
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
import { Fragment } from '@milkdown/prose/model';

export type RichTableOp =
  | 'addRowAfter'
  | 'addRowBefore'
  | 'addColAfter'
  | 'addColBefore'
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
