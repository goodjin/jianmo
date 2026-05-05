import { describe, it, expect, afterEach } from 'vitest';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { Fragment, Schema, type Node as PMNode } from '@milkdown/prose/model';
import { EditorState, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { isInTable, tableNodes } from 'prosemirror-tables';

import {
  interceptRichTableKeydown,
  richTablePlainEnterChain,
  richTableToggleListIndentInTable,
} from '../plugins/markly-table-rich';

let lastEditor: Editor | null = null;

function fireKeyDown(view: EditorView, init: KeyboardEventInit): boolean {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  return Boolean(view.someProp('handleKeyDown', (h) => h(view, ev)));
}

function locateTable(doc: PMNode): { table: PMNode; tablePos: number } | null {
  let hit: { table: PMNode; tablePos: number } | null = null;
  doc.descendants((node, pos) => {
    const role = (node.type.spec as { tableRole?: string }).tableRole;
    if (role === 'table') {
      hit = { table: node, tablePos: pos };
      return false;
    }
    return true;
  });
  return hit;
}

/** 取单元格内「最后一个段落」末尾（适配单元格里嵌列表等结构） */
function textSelectionLastParagraphEndInCell(doc: PMNode, cellAbs: number): TextSelection | null {
  const cell = doc.nodeAt(cellAbs);
  if (!cell) return null;
  const outerTo = cellAbs + cell.nodeSize;
  let last: TextSelection | null = null;
  doc.nodesBetween(cellAbs + 1, outerTo - 1, (node, pos) => {
    if (node.type.name !== 'paragraph') return true;
    const inner = doc.resolve(pos + 1);
    let d = inner.depth;
    while (d >= 0 && !inner.node(d).isTextblock) d--;
    if (d >= 0) last = TextSelection.create(doc, inner.end(d));
    return true;
  });
  return last;
}

/**
 * Milkdown：table = table_header_row + table_row+，与默认 TableMap 对「整块网格」的假说不一致，
 * TableMap.positionAt 易指到表格外。这里显式跳过 header，按第 N 个 table_row × 列索引定位单元格起点。
 */
function resolveMarklyTableBodyCellAbs(
  tablePos: number,
  tableNode: PMNode,
  bodyRowIndex: number,
  col: number
): number | null {
  let rowWalker = tablePos + 1;
  let tbodyIndex = -1;
  for (let i = 0; i < tableNode.childCount; i++) {
    const row = tableNode.child(i);
    const rowAbs = rowWalker;
    if (row.type.name === 'table_row') {
      tbodyIndex++;
      if (tbodyIndex === bodyRowIndex) {
        if (col < 0 || col >= row.childCount) return null;
        let cellAbs = rowAbs + 1;
        for (let c = 0; c < col; c++) cellAbs += row.child(c).nodeSize;
        return cellAbs;
      }
    }
    rowWalker += row.nodeSize;
  }
  return null;
}

/** bodyRowIndex：从 0 起计的第一个 table_body 行（不含 table_header_row） */
function caretInTableBodyCell(
  doc: PMNode,
  tablePos: number,
  tableNode: PMNode,
  bodyRowIndex: number,
  col: number
): TextSelection | null {
  const cellAbs = resolveMarklyTableBodyCellAbs(tablePos, tableNode, bodyRowIndex, col);
  if (cellAbs == null) return null;
  return textSelectionLastParagraphEndInCell(doc, cellAbs);
}

/** Milkdown GFM：`cellContent: "paragraph"`，单元格内无法合法嵌套列表；sink 语义用精简 PM schema 单独测 */
function minimalSchemaTableCellAllowsList(): Schema {
  const tn = tableNodes({
    tableGroup: 'block',
    cellContent: '(paragraph | bullet_list)',
    cellAttributes: {},
  });

  const nodes = {
    doc: { content: 'table' },
    text: { group: 'inline' },
    paragraph: {
      group: 'block',
      content: 'text*',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ['ul', 0];
      },
    },
    list_item: {
      defining: true,
      attrs: {
        label: { default: '•' },
        listType: { default: 'bullet' },
        spread: { default: true },
      },
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return ['li', 0];
      },
    },
    ...tn,
  };
  return new Schema({
    nodes: nodes as Schema['spec']['nodes'],
    marks: {},
  });
}

function editorStateBulletListSecondItemInCell(schema: Schema): EditorState {
  const paragraph = schema.nodes.paragraph!;
  const bulletList = schema.nodes.bullet_list!;
  const listItem = schema.nodes.list_item!;
  const list = bulletList.create(
    null,
    Fragment.from([
      listItem.create(null, paragraph.create(null, schema.text('a'))),
      listItem.create(null, paragraph.create(null, schema.text('b'))),
    ])
  );
  const cell = schema.nodes.table_cell.createAndFill({}, Fragment.from(list));
  if (!cell) throw new Error('failed to create cell');
  const row = schema.nodes.table_row.create(null, Fragment.from(cell));
  const table = schema.nodes.table.create(null, Fragment.from(row));
  const doc = schema.nodes.doc.create(null, Fragment.from(table));

  let cursor = 1;
  doc.descendants((node, pos) => {
    if (node.isText && node.text === 'b') cursor = pos + node.text.length;
  });
  return EditorState.create({ doc, selection: TextSelection.create(doc, cursor) });
}

async function makeTableEditor(md: string): Promise<{ view: EditorView; serializer: (doc: PMNode) => string }> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, el);
      ctx.set(defaultValueCtx, md);
    })
    .use(commonmark)
    .use(gfm)
    .use(columnResizingPlugin)
    .use(history)
    .create();
  lastEditor = editor;
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  return { view, serializer };
}

afterEach(() => {
  try {
    lastEditor?.destroy();
  } catch {
    // ignore
  } finally {
    lastEditor = null;
  }
  document.body.innerHTML = '';
});

describe('M56 rich table keyboard refinements', () => {
  it('sanity: plain enter chain splits inside body cell', async () => {
    const md = ['| h1 | h2 |', '| --- | --- |', '| A | B |'].join('\n');
    const { view } = await makeTableEditor(md);

    const loc = locateTable(view.state.doc);
    expect(loc).not.toBe(null);
    const sel = caretInTableBodyCell(view.state.doc, loc!.tablePos, loc!.table, 0, 0);
    expect(sel).not.toBe(null);
    view.dispatch(view.state.tr.setSelection(sel!));

    const cmd = richTablePlainEnterChain(view.state.schema);
    expect(cmd(view.state, view.dispatch, view)).toBe(true);
    expect(isInTable(view.state)).toBe(true);

    let foundHardBreak = false;
    view.state.doc.descendants((n) => {
      if (n.type.name === 'hardbreak') foundHardBreak = true;
      return true;
    });
    expect(foundHardBreak).toBe(true);
  });

  it('intercept: plain Enter inside a cell does not ExitTable', async () => {
    const md = ['| h1 | h2 |', '| --- | --- |', '| A | B |'].join('\n');
    const { view, serializer } = await makeTableEditor(md);

    const loc = locateTable(view.state.doc);
    expect(loc).not.toBe(null);
    const sel = caretInTableBodyCell(view.state.doc, loc!.tablePos, loc!.table, 0, 0);
    expect(sel).not.toBe(null);
    view.dispatch(view.state.tr.setSelection(sel!));

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    expect(interceptRichTableKeydown(view, ev)).toBe(true);

    expect(isInTable(view.state)).toBe(true);
    const next = serializer(view.state.doc);
    expect(next.includes('|')).toBe(true);
    expect(next.includes('h1')).toBe(true);
  });

  it('Mod+Enter still exits table (GFM ExitTable)', async () => {
    const md = ['| h1 |', '| --- |', '| A |'].join('\n');
    const { view } = await makeTableEditor(md);

    const loc = locateTable(view.state.doc);
    expect(loc).not.toBe(null);
    const sel = caretInTableBodyCell(view.state.doc, loc!.tablePos, loc!.table, 0, 0);
    expect(sel).not.toBe(null);
    view.dispatch(view.state.tr.setSelection(sel!));

    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
    const handled = fireKeyDown(
      view,
      mac ? { key: 'Enter', metaKey: true } : { key: 'Enter', ctrlKey: true }
    );
    expect(handled).toBe(true);
    expect(isInTable(view.state)).toBe(false);
  });

  it('unit: Tab sinks second list_item when cell schema allows bullet_list', () => {
    const schema = minimalSchemaTableCellAllowsList();
    let state = editorStateBulletListSecondItemInCell(schema);
    expect(isInTable(state)).toBe(true);
    const jsonBefore = JSON.stringify(state.doc.toJSON());
    const ok = richTableToggleListIndentInTable(state, (tr) => {
      state = state.apply(tr);
    }, false);
    expect(ok).toBe(true);
    expect(JSON.stringify(state.doc.toJSON())).not.toBe(jsonBefore);
    expect(isInTable(state)).toBe(true);
  });

  it('intercept Tab in Milkdown plain cell delegates (sink returns false)', async () => {
    const md = ['| col |', '| --- |', '| A |'].join('\n');
    const { view } = await makeTableEditor(md);

    const loc = locateTable(view.state.doc);
    expect(loc).not.toBe(null);
    const sel = caretInTableBodyCell(view.state.doc, loc!.tablePos, loc!.table, 0, 0);
    expect(sel).not.toBe(null);
    view.dispatch(view.state.tr.setSelection(sel!));

    const ok = interceptRichTableKeydown(view, new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(ok).toBe(false);
  });
});
