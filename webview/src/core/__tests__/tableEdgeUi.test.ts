/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { Schema, type Node as PMNode } from '@milkdown/prose/model';
import { EditorState, TextSelection } from '@milkdown/prose/state';
import { EditorView } from '@milkdown/prose/view';
import { CellSelection, TableMap } from 'prosemirror-tables';
import {
  deleteTableAxisSelection,
  insertTableColumnAtGap,
  insertTableRowAtGap,
  readTableAxisSelection,
  selectTableColumns,
  selectTableRows,
} from '../richTableCommands';
import {
  classifyEdgeAxis,
  classifyTableEdgeHover,
  indexForGapDrag,
  measureTableEdges,
  pickNearestTableIndex,
  tableSelectionBand,
} from '../tableEdgeUi';

const rows = [0, 40, 90, 120];
const cols = [0, 50, 110, 160];

function hover(x: number, y: number) {
  return classifyTableEdgeHover({ x, y, rowEdges: rows, colEdges: cols });
}

function createTestSchema() {
  const nodes = {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      toDOM() {
        return ['p', 0];
      },
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
    table: {
      group: 'block',
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      toDOM() {
        return ['table', ['tbody', 0]];
      },
      parseDOM: [{ tag: 'table' }],
    },
    table_row: {
      content: '(table_cell | table_header)+',
      tableRole: 'row',
      toDOM() {
        return ['tr', 0];
      },
      parseDOM: [{ tag: 'tr' }],
    },
    table_cell: {
      content: 'paragraph+',
      attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
      tableRole: 'cell',
      isolating: true,
      toDOM() {
        return ['td', 0];
      },
      parseDOM: [{ tag: 'td' }],
    },
    table_header: {
      content: 'paragraph+',
      attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
      tableRole: 'header_cell',
      isolating: true,
      toDOM() {
        return ['th', 0];
      },
      parseDOM: [{ tag: 'th' }],
    },
  } as const;
  return new Schema({ nodes: nodes as any, marks: {} });
}

function cell(schema: Schema, text: string, header = false) {
  const p = schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
  const type = header ? schema.nodes.table_header : schema.nodes.table_cell;
  return type.create(null, [p]);
}

function tableDoc(schema: Schema, grid: string[][]) {
  const row = schema.nodes.table_row;
  const rows = grid.map((line, r) =>
    row.create(
      null,
      line.map((text) => cell(schema, text, r === 0))
    )
  );
  return schema.nodes.doc.create(null, [schema.nodes.table.create(null, rows)]);
}

function firstTable(doc: PMNode): { node: PMNode; pos: number } {
  let found: { node: PMNode; pos: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'table') {
      found = { node, pos };
      return false;
    }
    return true;
  });
  if (!found) throw new Error('no table');
  return found;
}

function gridText(table: PMNode): string[][] {
  const out: string[][] = [];
  for (let r = 0; r < table.childCount; r++) {
    const row = table.child(r);
    const line: string[] = [];
    for (let c = 0; c < row.childCount; c++) line.push(row.child(c).textContent);
    out.push(line);
  }
  return out;
}

function openTable(grid: string[][]) {
  const schema = createTestSchema();
  const doc = tableDoc(schema, grid);
  const { pos } = firstTable(doc);
  const map = TableMap.get(firstTable(doc).node);
  const selection = TextSelection.create(doc, pos + 1 + map.positionAt(0, 0, firstTable(doc).node) + 2);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView(host, { state: EditorState.create({ schema, doc, selection }) });
  return { view, host, tablePos: pos };
}

describe('classifyTableEdgeHover', () => {
  it('表格内部不出现按钮', () => {
    expect(hover(30, 20)).toBeNull();
    expect(hover(80, 60)).toBeNull();
  });

  it('离表格太远不出现按钮', () => {
    expect(hover(-40, 20)).toBeNull();
    expect(hover(20, -40)).toBeNull();
  });

  it('左上外角不出现按钮', () => {
    expect(hover(-12, -12)).toBeNull();
  });

  it('行中段是行头，两行交界和表的上下边是加行', () => {
    expect(hover(-10, 20)).toEqual({ axis: 'row', kind: 'head', index: 0 });
    expect(hover(-10, 40)).toEqual({ axis: 'row', kind: 'gap', index: 1 });
    expect(hover(-10, 0)).toEqual({ axis: 'row', kind: 'gap', index: 0 });
    expect(hover(-10, 120)).toEqual({ axis: 'row', kind: 'gap', index: 3 });
    expect(hover(-10, 70)).toEqual({ axis: 'row', kind: 'head', index: 1 });
    expect(hover(-10, 100)).toEqual({ axis: 'row', kind: 'head', index: 2 });
  });

  it('贴着左边框内侧仍算行头', () => {
    expect(hover(2, 20)).toEqual({ axis: 'row', kind: 'head', index: 0 });
  });

  it('列中段是列头，两列交界和表的左右边是加列', () => {
    expect(hover(20, -10)).toEqual({ axis: 'col', kind: 'head', index: 0 });
    expect(hover(50, -10)).toEqual({ axis: 'col', kind: 'gap', index: 1 });
    expect(hover(0, -10)).toEqual({ axis: 'col', kind: 'gap', index: 0 });
    expect(hover(160, -8)).toEqual({ axis: 'col', kind: 'gap', index: 3 });
    expect(hover(80, -6)).toEqual({ axis: 'col', kind: 'head', index: 1 });
  });

  it('贴着上边框内侧仍算列头', () => {
    expect(hover(20, 2)).toEqual({ axis: 'col', kind: 'head', index: 0 });
  });

  it('矮行中间仍能点到行头', () => {
    const shortRows = [0, 16, 32];
    expect(classifyEdgeAxis(8, shortRows)?.kind).toBe('head');
    expect(classifyTableEdgeHover({ x: -8, y: 8, rowEdges: shortRows, colEdges: cols })).toEqual({
      axis: 'row',
      kind: 'head',
      index: 0,
    });
    expect(classifyTableEdgeHover({ x: -8, y: 16, rowEdges: shortRows, colEdges: cols })).toEqual({
      axis: 'row',
      kind: 'gap',
      index: 1,
    });
  });

  it('左上边框交界处更靠近哪条边就归哪条边', () => {
    expect(hover(1, 8)?.axis).toBe('row');
    expect(hover(8, 1)?.axis).toBe('col');
  });
});

describe('tableSelectionBand', () => {
  it('整行、多行是行选区', () => {
    expect(tableSelectionBand({ left: 0, right: 3, top: 1, bottom: 2, mapWidth: 3, mapHeight: 4 })).toEqual({
      axis: 'row',
      from: 1,
      to: 1,
    });
    expect(tableSelectionBand({ left: 0, right: 3, top: 0, bottom: 3, mapWidth: 3, mapHeight: 4 })).toEqual({
      axis: 'row',
      from: 0,
      to: 2,
    });
  });

  it('整列、多列是列选区', () => {
    expect(tableSelectionBand({ left: 1, right: 2, top: 0, bottom: 4, mapWidth: 3, mapHeight: 4 })).toEqual({
      axis: 'col',
      from: 1,
      to: 1,
    });
    expect(tableSelectionBand({ left: 0, right: 2, top: 0, bottom: 4, mapWidth: 3, mapHeight: 4 })).toEqual({
      axis: 'col',
      from: 0,
      to: 1,
    });
  });

  it('局部单元格和单个光标格不是行/列选区', () => {
    expect(tableSelectionBand({ left: 0, right: 2, top: 0, bottom: 2, mapWidth: 3, mapHeight: 4 })).toBeNull();
    expect(tableSelectionBand({ left: 1, right: 2, top: 1, bottom: 2, mapWidth: 3, mapHeight: 4 })).toBeNull();
  });

  it('整张表按行选区处理，方便一次删掉', () => {
    expect(tableSelectionBand({ left: 0, right: 3, top: 0, bottom: 4, mapWidth: 3, mapHeight: 4 })).toEqual({
      axis: 'row',
      from: 0,
      to: 3,
    });
  });
});

describe('pickNearestTableIndex / indexForGapDrag / measureTableEdges', () => {
  it('近处的表优先，重叠时取更小的里层表', () => {
    const rects = [
      { left: 0, top: 0, right: 200, bottom: 200 },
      { left: 20, top: 20, right: 80, bottom: 80 },
    ];
    expect(pickNearestTableIndex(rects, 40, 40, 28)).toBe(1);
    expect(pickNearestTableIndex(rects, 10, 10, 28)).toBe(0);
    expect(pickNearestTableIndex(rects, 190, -10, 28)).toBe(0);
    expect(pickNearestTableIndex(rects, 400, 400, 28)).toBe(-1);
  });

  it('拖过交界时落到相邻行，末尾交界落在最后一行', () => {
    expect(indexForGapDrag(0, 3)).toBe(0);
    expect(indexForGapDrag(1, 3)).toBe(1);
    expect(indexForGapDrag(3, 3)).toBe(2);
    expect(indexForGapDrag(0, 0)).toBe(0);
  });

  it('按 DOM 行和单元格量出交界', () => {
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    table.appendChild(body);
    const stub = (el: HTMLElement, left: number, top: number, width: number, height: number) => {
      el.getBoundingClientRect = () =>
        ({
          left,
          top,
          right: left + width,
          bottom: top + height,
          width,
          height,
          x: left,
          y: top,
          toJSON() {
            return {};
          },
        }) as DOMRect;
    };
    stub(table, 10, 20, 100, 40);
    for (let r = 0; r < 2; r++) {
      const tr = document.createElement('tr');
      stub(tr, 10, 20 + r * 20, 100, 20);
      for (let c = 0; c < 2; c++) {
        const td = document.createElement('td');
        stub(td, 10 + c * 50, 20 + r * 20, 50, 20);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    expect(measureTableEdges(table)).toEqual({
      rowEdges: [0, 20, 40],
      colEdges: [0, 50, 100],
      width: 100,
      height: 40,
    });
  });
});

describe('表格边上的插入、选中和删除', () => {
  it('在第一行前、两行之间、最后一行后插入行', () => {
    const { view, host, tablePos } = openTable([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(insertTableRowAtGap(view, tablePos, 1)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([
      ['a', 'b'],
      ['', ''],
      ['c', 'd'],
    ]);

    expect(insertTableRowAtGap(view, tablePos, 0)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)[0]).toEqual(['', '']);
    expect(gridText(firstTable(view.state.doc).node)[1]).toEqual(['a', 'b']);

    const height = firstTable(view.state.doc).node.childCount;
    expect(insertTableRowAtGap(view, tablePos, height)).toBe(true);
    const after = gridText(firstTable(view.state.doc).node);
    expect(after[after.length - 1]).toEqual(['', '']);
    expect(after[after.length - 2]).toEqual(['c', 'd']);

    view.destroy();
    host.remove();
  });

  it('在最左、两列之间、最右插入列', () => {
    const { view, host, tablePos } = openTable([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(insertTableColumnAtGap(view, tablePos, 1)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([
      ['a', '', 'b'],
      ['c', '', 'd'],
    ]);

    expect(insertTableColumnAtGap(view, tablePos, 0)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([
      ['', 'a', '', 'b'],
      ['', 'c', '', 'd'],
    ]);

    const width = firstTable(view.state.doc).node.child(0).childCount;
    expect(insertTableColumnAtGap(view, tablePos, width)).toBe(true);
    const after = gridText(firstTable(view.state.doc).node);
    expect(after[0][after[0].length - 1]).toBe('');
    expect(after[0][after[0].length - 2]).toBe('b');
    expect(after[1][after[1].length - 2]).toBe('d');

    view.destroy();
    host.remove();
  });

  it('点行头选中一行，光标停在格子里不算选中行', () => {
    const { view, host, tablePos } = openTable([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
    expect(readTableAxisSelection(view.state)).toBeNull();
    expect(selectTableRows(view, tablePos, 1, 1)).toBe(true);
    expect(readTableAxisSelection(view.state)).toEqual({ axis: 'row', from: 1, to: 1 });
    expect(view.state.selection instanceof CellSelection).toBe(true);
    view.destroy();
    host.remove();
  });

  it('选中多行后一次删除，旁边的行还在', () => {
    const { view, host, tablePos } = openTable([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
    expect(selectTableRows(view, tablePos, 0, 1)).toBe(true);
    expect(readTableAxisSelection(view.state)).toEqual({ axis: 'row', from: 0, to: 1 });
    expect(deleteTableAxisSelection(view)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([['e', 'f']]);
    view.destroy();
    host.remove();
  });

  it('选中多列后一次删除，旁边的列还在', () => {
    const { view, host, tablePos } = openTable([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
    expect(selectTableColumns(view, tablePos, 0, 1)).toBe(true);
    expect(readTableAxisSelection(view.state)).toEqual({ axis: 'col', from: 0, to: 1 });
    expect(deleteTableAxisSelection(view)).toBe(true);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([
      ['c'],
      ['f'],
    ]);
    view.destroy();
    host.remove();
  });

  it('选中全部行或全部列时删掉整张表', () => {
    const rows = openTable([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(selectTableRows(rows.view, rows.tablePos, 0, 1)).toBe(true);
    expect(deleteTableAxisSelection(rows.view)).toBe(true);
    expect(rows.view.state.doc.child(0).type.name).toBe('paragraph');
    rows.view.destroy();
    rows.host.remove();

    const cols = openTable([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(selectTableColumns(cols.view, cols.tablePos, 0, 1)).toBe(true);
    expect(deleteTableAxisSelection(cols.view)).toBe(true);
    expect(cols.view.state.doc.child(0).type.name).toBe('paragraph');
    cols.view.destroy();
    cols.host.remove();
  });

  it('没有整行或整列选区时删除不做任何事', () => {
    const { view, host } = openTable([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(deleteTableAxisSelection(view)).toBe(false);
    expect(gridText(firstTable(view.state.doc).node)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    view.destroy();
    host.remove();
  });
});
