import type { EditorView } from '@milkdown/prose/view';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  isInTable,
  selectedRect,
  toggleHeaderRow,
} from 'prosemirror-tables';

export type RichTableOp =
  | 'addRowAfter'
  | 'addRowBefore'
  | 'addColAfter'
  | 'addColBefore'
  | 'deleteRow'
  | 'deleteCol'
  | 'toggleHeaderRow'
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
