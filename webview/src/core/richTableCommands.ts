import type { EditorView } from '@milkdown/prose/view';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  isInTable,
} from 'prosemirror-tables';

export type RichTableOp =
  | 'addRowAfter'
  | 'addRowBefore'
  | 'addColAfter'
  | 'addColBefore'
  | 'deleteRow'
  | 'deleteCol';

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
    default:
      return false;
  }
}
