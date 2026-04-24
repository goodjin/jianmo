/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { Schema, Slice } from '@milkdown/prose/model';
import { EditorState, TextSelection } from '@milkdown/prose/state';
import { EditorView } from '@milkdown/prose/view';
import { CellSelection, TableMap } from 'prosemirror-tables';
import { runRichTableOp } from '../../core/richTableCommands';
import {
  MARKLY_TABLE_PASTE_MAX_COLS,
  MARKLY_TABLE_PASTE_MAX_ROWS,
  createMarklyTableGridPastePlugin,
  decideTableGridSelectionFillMapping,
  parseHtmlTableToGrid,
  parseCsvLine,
  parseCsvLineStrict,
  parseDelimitedGridForTablePaste,
  parseTablePasteMatrix,
} from '../markly-table-rich';

describe('markly-table-rich decideTableGridSelectionFillMapping (N3-1)', () => {
  it('exact：grid 与选区尺寸完全一致', () => {
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 2, gridWidth: 3, selHeight: 2, selWidth: 3 })
    ).toEqual({ mode: 'exact' });
  });

  it('broadcast：grid 为 1x1，填充整个选区', () => {
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 1, gridWidth: 1, selHeight: 4, selWidth: 5 })
    ).toEqual({ mode: 'broadcast' });
  });

  it('repeatRow：grid 为 1xW 且 W==selW，重复填充 selH 行', () => {
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 1, gridWidth: 3, selHeight: 6, selWidth: 3 })
    ).toEqual({ mode: 'repeatRow', repeatRowStride: 1 });
  });

  it('repeatCol：grid 为 Hx1 且 H==selH，重复填充 selW 列', () => {
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 4, gridWidth: 1, selHeight: 4, selWidth: 7 })
    ).toEqual({ mode: 'repeatCol', repeatColStride: 1 });
  });

  it('reject：其他情况一律拒绝（且避免误判 repeatRow/repeatCol/broadcast）', () => {
    // 尺寸不一致（非 exact）
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 2, gridWidth: 2, selHeight: 2, selWidth: 3 })
    ).toEqual({ mode: 'reject' });

    // 1xW 但 W!=selW：不能误判 repeatRow
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 1, gridWidth: 2, selHeight: 5, selWidth: 3 })
    ).toEqual({ mode: 'reject' });

    // Hx1 但 H!=selH：不能误判 repeatCol
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 3, gridWidth: 1, selHeight: 4, selWidth: 8 })
    ).toEqual({ mode: 'reject' });

    // 非正整数输入：直接 reject
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 1, gridWidth: 1, selHeight: 0, selWidth: 2 })
    ).toEqual({ mode: 'reject' });
  });

  it('1x1 对 1x1：按 exact 优先（避免与 broadcast 冲突）', () => {
    expect(
      decideTableGridSelectionFillMapping({ gridHeight: 1, gridWidth: 1, selHeight: 1, selWidth: 1 })
    ).toEqual({ mode: 'exact' });
  });
});

describe('markly-table-rich parseDelimitedGridForTablePaste', () => {
  it('parses TSV into a rectangular grid', () => {
    const g = parseDelimitedGridForTablePaste('a\tb\nc\td\n');
    expect(g).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('pads short TSV rows', () => {
    const g = parseDelimitedGridForTablePaste('a\tb\tc\nd\t\n');
    expect(g).toEqual([
      ['a', 'b', 'c'],
      ['d', '', ''],
    ]);
  });

  it('parses multi-line CSV', () => {
    const g = parseDelimitedGridForTablePaste('a,b\n1,2\n');
    expect(g).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('parses single-line CSV with at least two columns', () => {
    const g = parseDelimitedGridForTablePaste('x,y,z');
    expect(g).toEqual([['x', 'y', 'z']]);
  });

  it('returns null for ambiguous plain text', () => {
    expect(parseDelimitedGridForTablePaste('hello')).toBeNull();
    expect(parseDelimitedGridForTablePaste('a')).toBeNull();
    expect(parseDelimitedGridForTablePaste('a\n')).toBeNull();
  });

  it('returns null for multi-line plain text without commas (not a csv matrix)', () => {
    expect(parseDelimitedGridForTablePaste('hello\nworld')).toBeNull();
  });

  it('returns null when multi-line csv is inconsistent', () => {
    expect(parseDelimitedGridForTablePaste('a,b\nc')).toBeNull();
  });

  it('returns null when grid exceeds row limit', () => {
    const row = Array.from({ length: MARKLY_TABLE_PASTE_MAX_COLS }, (_, i) => `c${i}`).join(',');
    const lines = Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, () => row).join('\n');
    expect(parseDelimitedGridForTablePaste(lines)).toBeNull();
  });

  it('returns null when grid exceeds col limit', () => {
    const row = Array.from({ length: MARKLY_TABLE_PASTE_MAX_COLS + 1 }, (_, i) => `c${i}`).join(',');
    expect(parseDelimitedGridForTablePaste(row)).toBeNull();
  });
});

describe('markly-table-rich parseCsvLine', () => {
  it('supports quoted commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('supports escaped quotes', () => {
    expect(parseCsvLine('"a""b",c')).toEqual(['a"b', 'c']);
  });
});

describe('markly-table-rich parseCsvLineStrict', () => {
  it('supports trailing commas as empty fields', () => {
    expect(parseCsvLineStrict('a,b,')).toEqual(['a', 'b', '']);
  });

  it('returns null for unclosed quotes', () => {
    expect(parseCsvLineStrict('"a,b')).toBeNull();
  });

  it('returns null for junk after closing quote', () => {
    expect(parseCsvLineStrict('"a"b,c')).toBeNull();
  });
});

describe('markly-table-rich parseHtmlTableToGrid', () => {
  it('parses a simple html table into a rectangular grid', () => {
    const html = `<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>`;
    expect(parseHtmlTableToGrid(html)).toEqual({
      grid: [
        ['a', 'b'],
        ['1', '2'],
      ],
      reason: null,
    });
  });

  it('expands colspan/rowspan into a rectangular grid', () => {
    const html = `<table><tr><td colspan="2">a</td></tr><tr><td>1</td><td>2</td></tr></table>`;
    expect(parseHtmlTableToGrid(html)).toEqual({
      grid: [
        ['a', ''],
        ['1', '2'],
      ],
      reason: null,
    });

    const html2 = `<table><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr></table>`;
    expect(parseHtmlTableToGrid(html2)).toEqual({
      grid: [
        ['a', 'b'],
        ['', 'c'],
      ],
      reason: null,
    });
  });

  it('returns null when html has only one column', () => {
    const html = `<table><tr><td>a</td></tr><tr><td>b</td></tr></table>`;
    expect(parseHtmlTableToGrid(html).grid).toBeNull();
  });
});

describe('markly-table-rich parseTablePasteMatrix', () => {
  it('prefers html grid over plain fallback', () => {
    const html = `<table><tr><td>h1</td><td>h2</td></tr><tr><td>1</td><td>2</td></tr></table>`;
    const plain = 'p1\tp2\n3\t4\n';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: [
        ['h1', 'h2'],
        ['1', '2'],
      ],
      source: 'html',
      reason: null,
      htmlReason: null,
      htmlCandidate: true,
      plainReason: null,
      plainCandidate: false,
    });
  });

  it('falls back to plain when html has no table', () => {
    const html = `<div>no table</div>`;
    const plain = 'a\tb\nc\td\n';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      source: 'plain',
      reason: null,
      htmlReason: 'no_table',
      htmlCandidate: false,
      plainReason: null,
      plainCandidate: true,
    });
  });

  it('returns html over_limit as terminal failure', () => {
    const rows = Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, (_, r) => `<tr><td>r${r}c1</td><td>r${r}c2</td></tr>`).join('');
    const html = `<table>${rows}</table>`;
    const plain = 'a\tb\nc\td\n';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: null,
      source: 'html',
      reason: 'over_limit',
      htmlReason: 'over_limit',
      htmlCandidate: true,
      plainReason: null,
      plainCandidate: false,
    });
  });

  it('returns plain over_limit when plain grid exceeds limits', () => {
    const row = Array.from({ length: MARKLY_TABLE_PASTE_MAX_COLS }, (_, i) => `c${i}`).join(',');
    const lines = Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, () => row).join('\n');
    expect(parseTablePasteMatrix('', lines)).toEqual({
      grid: null,
      source: 'plain',
      reason: 'over_limit',
      htmlReason: 'no_table',
      htmlCandidate: false,
      plainReason: 'over_limit',
      plainCandidate: true,
    });
  });

  it('returns plain not_grid when plain cannot be parsed as a grid', () => {
    expect(parseTablePasteMatrix('', 'hello world')).toEqual({
      grid: null,
      source: 'plain',
      reason: 'not_grid',
      htmlReason: 'no_table',
      htmlCandidate: false,
      plainReason: 'not_grid',
      plainCandidate: false,
    });
  });

  it('falls back to plain when html is invalid (e.g. 1-col table)', () => {
    const html = `<table><tr><td>a</td></tr><tr><td>b</td></tr></table>`;
    const plain = 'x\ty\n1\t2\n';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: [
        ['x', 'y'],
        ['1', '2'],
      ],
      source: 'plain',
      reason: null,
      htmlReason: 'invalid',
      htmlCandidate: true,
      plainReason: null,
      plainCandidate: true,
    });
  });

  it('html invalid（1-col）且 plain not_grid：source/reason 与细分 reason 一致（可驱动 shouldHint）', () => {
    const html = `<table><tr><td>a</td></tr><tr><td>b</td></tr></table>`;
    const plain = 'hello world';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: null,
      source: 'html',
      reason: 'invalid',
      htmlReason: 'invalid',
      htmlCandidate: true,
      plainReason: 'not_grid',
      plainCandidate: false,
    });
  });

  it('html no_table + plain 多行严格 CSV：成功解析为 plain grid', () => {
    const html = `<div>no table</div>`;
    const plain = 'a,b\n1,2\n3,4\n';
    expect(parseTablePasteMatrix(html, plain)).toEqual({
      grid: [
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ],
      source: 'plain',
      reason: null,
      htmlReason: 'no_table',
      htmlCandidate: false,
      plainReason: null,
      plainCandidate: true,
    });
  });
});

describe('markly-table-rich marklyTableGridPastePlugin (N2-2)', () => {
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

  function create2x2TableDoc(schema: Schema, values?: [[string, string], [string, string]]) {
    const v = values ?? [
      ['a', 'b'],
      ['c', 'd'],
    ];
    const p = (t: string) => schema.nodes.paragraph.create(null, t ? schema.text(t) : null);
    const header = schema.nodes.table_header;
    const cell = schema.nodes.table_cell;
    const row = schema.nodes.table_row;
    const table = schema.nodes.table;

    return schema.nodes.doc.create(null, [
      table.create(null, [
        row.create(null, [header.create(null, [p(v[0][0])]), header.create(null, [p(v[0][1])])]),
        row.create(null, [cell.create(null, [p(v[1][0])]), cell.create(null, [p(v[1][1])])]),
      ]),
    ]);
  }

  function create2x2MixedHeaderBodyTableDoc(schema: Schema, values?: [[string, string], [string, string]]) {
    const v = values ?? [
      ['h1', 'b1'],
      ['c1', 'c2'],
    ];
    const p = (t: string) => schema.nodes.paragraph.create(null, t ? schema.text(t) : null);
    const header = schema.nodes.table_header;
    const cell = schema.nodes.table_cell;
    const row = schema.nodes.table_row;
    const table = schema.nodes.table;

    // “混合”：首行同时包含 header 与普通 cell
    return schema.nodes.doc.create(null, [
      table.create(null, [
        row.create(null, [header.create(null, [p(v[0][0])]), cell.create(null, [p(v[0][1])])]),
        row.create(null, [cell.create(null, [p(v[1][0])]), cell.create(null, [p(v[1][1])])]),
      ]),
    ]);
  }

  function firstTableNode(doc: any) {
    let found: any = null;
    doc.descendants((node: any) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        found = node;
        return false;
      }
      return;
    });
    return found;
  }

  function docHasTable(schema: Schema, doc: any) {
    const tableRole = (schema.nodes as any).table?.spec?.tableRole ?? 'table';
    let found = false;
    doc.descendants((node: any) => {
      if ((node.type.spec as any)?.tableRole === tableRole) {
        found = true;
        return false;
      }
      return;
    });
    return found;
  }

  it('表格外粘贴矩阵时：返回 true，并在当前 selection 插入新表格（首行 header）', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('hello')),
    ]);

    const p = doc.child(0);
    const cursorPos = 1 + p.content.size; // paragraph 末尾
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({
      schema,
      doc,
      selection,
      plugins: [plugin],
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const event = ({
      clipboardData: {
        getData: (type: string) => {
          if (type === 'text/plain') return 'h1\th2\n1\t2\n';
          return '';
        },
      },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    let tableNode: any = null;
    view.state.doc.descendants((node) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tableNode = node;
        return false;
      }
      return;
    });

    expect(tableNode).not.toBeNull();
    expect(tableNode.childCount).toBe(2);
    expect(tableNode.child(0).child(0).type.name).toBe('table_header');
    expect(tableNode.child(1).child(0).type.name).toBe('table_cell');

    view.destroy();
    host.remove();
  });

  it('表格外建表：html table 与 plain 同时存在时，确实使用 html grid（首行内容来自 html）', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('hello'))]);
    const p = doc.child(0);
    const cursorPos = 1 + p.content.size;
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const html = `<table><tr><td>H_HTML_1</td><td>H_HTML_2</td></tr><tr><td>R1C1</td><td>R1C2</td></tr></table>`;
    const plain = 'H_PLAIN_1\tH_PLAIN_2\nP1\tP2\n';
    const event = ({
      clipboardData: {
        getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
      },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    let tableNode: any = null;
    view.state.doc.descendants((node) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tableNode = node;
        return false;
      }
      return;
    });
    expect(tableNode).not.toBeNull();

    const headerRow = tableNode.child(0);
    const headerCell0 = headerRow.child(0);
    const headerCell1 = headerRow.child(1);
    expect(headerCell0.textContent).toBe('H_HTML_1');
    expect(headerCell1.textContent).toBe('H_HTML_2');

    view.destroy();
    host.remove();
  });

  it('表格外粘贴超限矩阵时：toast + return true（拦截），且不会插入 table', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('hello'))]);
    const p = doc.child(0);
    const cursorPos = 1 + p.content.size;
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const bigRows = Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, (_, r) => `<tr><td>r${r}c1</td><td>r${r}c2</td></tr>`).join('');
    const html = `<table>${bigRows}</table>`;
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/html' ? html : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);
    expect(docHasTable(schema, view.state.doc)).toBe(false);
    expect(dispatched.some((e) => (e as any).type === 'markly:toast' && String((e as any).detail?.message ?? '').includes('上限'))).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('表格外：html 是 1 列 table（候选但 invalid）且 plain 非矩阵时：轻 toast + return false，且不会插入 table', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('hello'))]);
    const p = doc.child(0);
    const cursorPos = 1 + p.content.size;
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const html = `<table><tr><td>a</td></tr><tr><td>b</td></tr></table>`;
    const plain = 'hello world';
    const event = ({
      clipboardData: {
        getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
      },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(false);
    expect(docHasTable(schema, view.state.doc)).toBe(false);
    expect(dispatched.some((e) => (e as any).type === 'markly:toast' && String((e as any).detail?.message ?? '').includes('未能解析为表格矩阵'))).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('表格外：plain 看起来像多行 CSV 但非矩阵时：轻 toast + return false，且不会插入 table', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('hello'))]);
    const p = doc.child(0);
    const cursorPos = 1 + p.content.size;
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const plain = 'a,b\nc\n'; // 多行且含逗号，但不是矩阵（列数不一致）
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? plain : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(false);
    expect(docHasTable(schema, view.state.doc)).toBe(false);
    expect(dispatched.some((e) => (e as any).type === 'markly:toast' && String((e as any).detail?.message ?? '').includes('未能解析为表格矩阵'))).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('表格外：普通文本粘贴时：return false，不 toast，且不会插入 table', () => {
    const schema = createTestSchema();
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('hello'))]);
    const p = doc.child(0);
    const cursorPos = 1 + p.content.size;
    const selection = TextSelection.create(doc, cursorPos);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'hello world' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(false);
    expect(docHasTable(schema, view.state.doc)).toBe(false);
    expect(dispatched.some((e) => (e as any).type === 'markly:toast')).toBe(false);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('N3-2 表格内 CellSelection：exact 映射写入选区（不扩展行列）', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'A\tB\nC\tD\n' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const tableNode = firstTableNode(view.state.doc);
    expect(tableNode).not.toBeNull();
    expect(tableNode.childCount).toBe(2);
    expect(tableNode.child(0).childCount).toBe(2);
    expect(tableNode.child(1).childCount).toBe(2);

    const row0 = tableNode.child(0);
    const row1 = tableNode.child(1);
    expect(row0.child(0).textContent).toBe('A');
    expect(row0.child(1).textContent).toBe('B');
    expect(row1.child(0).textContent).toBe('C');
    expect(row1.child(1).textContent).toBe('D');

    view.destroy();
    host.remove();
  });

  it('N3-2 表格内 CellSelection：broadcast 用 grid[0][0] 写满选区（不扩展行列）', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'Z' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const tableNode = firstTableNode(view.state.doc);
    expect(tableNode).not.toBeNull();
    expect(tableNode.childCount).toBe(2);
    expect(tableNode.child(0).childCount).toBe(2);
    expect(tableNode.child(1).childCount).toBe(2);

    const row0 = tableNode.child(0);
    const row1 = tableNode.child(1);
    expect(row0.child(0).textContent).toBe('Z');
    expect(row0.child(1).textContent).toBe('Z');
    expect(row1.child(0).textContent).toBe('Z');
    expect(row1.child(1).textContent).toBe('Z');

    view.destroy();
    host.remove();
  });

  it('N3-4 表格内 CellSelection：repeatRow（1xW -> HxW）重复填充选区行（不扩展行列）', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    // 1x2 TSV：repeatRow，第二行应重复第一行
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'A\tB\n' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const tableNode = firstTableNode(view.state.doc);
    expect(tableNode).not.toBeNull();
    const row0 = tableNode.child(0);
    const row1 = tableNode.child(1);
    expect(row0.child(0).textContent).toBe('A');
    expect(row0.child(1).textContent).toBe('B');
    expect(row1.child(0).textContent).toBe('A');
    expect(row1.child(1).textContent).toBe('B');

    view.destroy();
    host.remove();
  });

  it('N3-4 表格内 CellSelection：repeatCol（Hx1 -> HxW）重复填充选区列（不扩展行列）', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    // 2 行单列文本：repeatCol，第二列应重复第一列
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'A\nB\n' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const tableNode = firstTableNode(view.state.doc);
    expect(tableNode).not.toBeNull();
    const row0 = tableNode.child(0);
    const row1 = tableNode.child(1);
    expect(row0.child(0).textContent).toBe('A');
    expect(row0.child(1).textContent).toBe('A');
    expect(row1.child(0).textContent).toBe('B');
    expect(row1.child(1).textContent).toBe('B');

    view.destroy();
    host.remove();
  });

  it('N3-4 表格内 CellSelection：reject（矩阵与选区不匹配）会拦截 + toast + doc 不变（不会扩表）', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const before = view.state.doc.toJSON();

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    // 2x3 TSV：对 2x2 选区必定 reject，且应拦截避免 insertCells 扩表
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? '1\t2\t3\n4\t5\t6\n' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const after = view.state.doc.toJSON();
    expect(after).toEqual(before);
    expect(
      dispatched.some(
        (e) =>
          (e as any).type === 'markly:toast' &&
          String((e as any).detail?.message ?? '').includes('不匹配')
      )
    ).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('N4-4 表格内 CellSelection：超限矩阵会 toast + 拦截（return true），且 doc 不变', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const before = view.state.doc.toJSON();

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const tooManyRows =
      Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, () => '1\t2').join('\n') + '\n';
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? tooManyRows : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);
    expect(view.state.doc.toJSON()).toEqual(before);
    expect(
      dispatched.some(
        (e) => (e as any).type === 'markly:toast' && String((e as any).detail?.message ?? '').includes('过大')
      )
    ).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('N4-4 表格内 TextSelection：超限矩阵会 toast + 拦截（return true），避免默认粘贴卡顿', () => {
    const schema = createTestSchema();
    const doc = create2x2TableDoc(schema, [
      ['h1', 'h2'],
      ['x1', 'x2'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const firstBodyCell = tableStart + map.positionAt(1, 0, foundTableNode);
    // 进入 table_cell -> paragraph -> text，避免 TextSelection 指向非 inline 容器导致的 PM 警告
    const selection = TextSelection.create(doc, firstBodyCell + 3);

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const before = view.state.doc.toJSON();

    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = ((e: Event) => {
      dispatched.push(e);
      return origDispatch(e);
    }) as any;

    const tooManyRows =
      Array.from({ length: MARKLY_TABLE_PASTE_MAX_ROWS + 1 }, () => '1\t2').join('\n') + '\n';
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? tooManyRows : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);
    expect(view.state.doc.toJSON()).toEqual(before);
    expect(
      dispatched.some(
        (e) => (e as any).type === 'markly:toast' && String((e as any).detail?.message ?? '').includes('过大')
      )
    ).toBe(true);

    window.dispatchEvent = origDispatch;
    view.destroy();
    host.remove();
  });

  it('N3-3 表格内 CellSelection 覆盖 header+body：填充后仍保持原 cell type（table_header/table_cell 不互相污染）', () => {
    const schema = createTestSchema();
    const doc = create2x2MixedHeaderBodyTableDoc(schema, [
      ['H', 'B'],
      ['C', 'D'],
    ]);

    let tablePos: number | null = null;
    let foundTableNode: any = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        tablePos = pos;
        foundTableNode = node;
        return false;
      }
      return;
    });
    expect(tablePos).not.toBeNull();
    expect(foundTableNode).not.toBeNull();

    const map = TableMap.get(foundTableNode);
    const tableStart = (tablePos as number) + 1;
    const topLeftCell = tableStart + map.positionAt(0, 0, foundTableNode);
    const bottomRightCell = tableStart + map.positionAt(1, 1, foundTableNode);
    const selection = new CellSelection(doc.resolve(topLeftCell), doc.resolve(bottomRightCell));

    const plugin = createMarklyTableGridPastePlugin();
    const state = EditorState.create({ schema, doc, selection, plugins: [plugin] });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    // 用 exact 填充 2x2，选区覆盖首行（含 header）+ body
    const event = ({
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'A\tB\nC\tD\n' : '') },
    } as unknown) as ClipboardEvent;

    const handled = plugin.props.handlePaste?.(view, event, Slice.empty) ?? false;
    expect(handled).toBe(true);

    const tableNode = firstTableNode(view.state.doc);
    expect(tableNode).not.toBeNull();
    const row0 = tableNode.child(0);
    const row1 = tableNode.child(1);

    // 断言：类型保持不变（这是 N3-3 的关键）
    expect(row0.child(0).type.name).toBe('table_header');
    expect(row0.child(1).type.name).toBe('table_cell');
    expect(row1.child(0).type.name).toBe('table_cell');
    expect(row1.child(1).type.name).toBe('table_cell');

    // 同时断言：内容确实写入（避免“假测试”）
    expect(row0.child(0).textContent).toBe('A');
    expect(row0.child(1).textContent).toBe('B');
    expect(row1.child(0).textContent).toBe('C');
    expect(row1.child(1).textContent).toBe('D');

    view.destroy();
    host.remove();
  });
});

describe('richTableCommands mergeCells/splitCell (N1-1)', () => {
  function createMinimalTableSchema() {
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
        // 注意：mergeCells 可能让某些行变成“空行”，这里用 * 以兼容结构变化
        content: '(table_cell | table_header)*',
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

  function create2x2TableDoc(schema: Schema) {
    const p = (t: string) => schema.nodes.paragraph.create(null, t ? schema.text(t) : null);
    const cell = schema.nodes.table_cell;
    const row = schema.nodes.table_row;
    const table = schema.nodes.table;

    return schema.nodes.doc.create(null, [
      table.create(null, [
        row.create(null, [cell.create(null, [p('a')]), cell.create(null, [p('b')])]),
        row.create(null, [cell.create(null, [p('c')]), cell.create(null, [p('d')])]),
      ]),
    ]);
  }

  function cellTextWithBlockSep(cell: any): string {
    // textContent 不一定能区分段落边界；这里用 textBetween 强制用 \n 作为 block separator
    return cell?.textBetween?.(0, cell.content.size, '\n', '\n') ?? (cell?.textContent ?? '');
  }

  function findFirstTable(doc: any): { node: any; pos: number } | null {
    let found: { node: any; pos: number } | null = null;
    doc.descendants((node: any, pos: number) => {
      if ((node.type.spec as any)?.tableRole === 'table') {
        found = { node, pos };
        return false;
      }
      return;
    });
    return found;
  }

  it('mergeCells 合并 2x2 后 colspan/rowspan 改变，splitCell 后回到 1', () => {
    const schema = createMinimalTableSchema();
    const doc = create2x2TableDoc(schema);

    const initial = findFirstTable(doc);
    expect(initial).not.toBeNull();
    const tablePos = initial!.pos;
    const table = initial!.node;
    const map = TableMap.get(table);
    expect(map.width).toBe(2);
    expect(map.height).toBe(2);

    const tableStart = tablePos + 1;
    const topLeftCellPos = tableStart + map.positionAt(0, 0, table);
    const bottomRightCellPos = tableStart + map.positionAt(1, 1, table);
    const selection = new CellSelection(doc.resolve(topLeftCellPos), doc.resolve(bottomRightCellPos));

    const state = EditorState.create({ schema, doc, selection });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const merged = runRichTableOp(view, 'mergeCells');
    expect(merged).toBe(true);

    const afterMerge = findFirstTable(view.state.doc);
    expect(afterMerge).not.toBeNull();
    const tableAfterMerge = afterMerge!.node;
    const mapAfterMerge = TableMap.get(tableAfterMerge);
    expect(mapAfterMerge.width).toBe(2);
    expect(mapAfterMerge.height).toBe(2);

    // 断言：左上角 cell 变成 2x2 合并单元（真实结构变化，不是假测试）
    const tableStartAfterMerge = afterMerge!.pos + 1;
    const mergedTopLeftPos = tableStartAfterMerge + mapAfterMerge.positionAt(0, 0, tableAfterMerge);
    const mergedTopLeftNode = view.state.doc.nodeAt(mergedTopLeftPos);
    expect(mergedTopLeftNode).not.toBeNull();
    expect(mergedTopLeftNode!.attrs.colspan).toBe(2);
    expect(mergedTopLeftNode!.attrs.rowspan).toBe(2);

    // splitCell 需要落点在该合并单元格内（放到 cell 里 paragraph 的内容位置，避免 TextSelection endpoint 警告）
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, mergedTopLeftPos + 2)));

    const split = runRichTableOp(view, 'splitCell');
    expect(split).toBe(true);

    const afterSplit = findFirstTable(view.state.doc);
    expect(afterSplit).not.toBeNull();
    const tableAfterSplit = afterSplit!.node;
    const mapAfterSplit = TableMap.get(tableAfterSplit);
    expect(mapAfterSplit.width).toBe(2);
    expect(mapAfterSplit.height).toBe(2);

    const tableStartAfterSplit = afterSplit!.pos + 1;
    const topLeftAfterSplitPos = tableStartAfterSplit + mapAfterSplit.positionAt(0, 0, tableAfterSplit);
    const topLeftAfterSplitNode = view.state.doc.nodeAt(topLeftAfterSplitPos);
    expect(topLeftAfterSplitNode).not.toBeNull();
    expect(topLeftAfterSplitNode!.attrs.colspan).toBe(1);
    expect(topLeftAfterSplitNode!.attrs.rowspan).toBe(1);

    view.destroy();
    host.remove();
  });

  it('N1-3 mergeCells：合并前先把 2x2 所有 cell 纯文本拼到 anchor cell，merge/split 后文本不丢', () => {
    const schema = createMinimalTableSchema();
    const doc = create2x2TableDoc(schema);

    const initial = findFirstTable(doc);
    expect(initial).not.toBeNull();
    const tablePos = initial!.pos;
    const table = initial!.node;
    const map = TableMap.get(table);
    expect(map.width).toBe(2);
    expect(map.height).toBe(2);

    const tableStart = tablePos + 1;
    const topLeftCellPos = tableStart + map.positionAt(0, 0, table);
    const bottomRightCellPos = tableStart + map.positionAt(1, 1, table);
    const selection = new CellSelection(doc.resolve(topLeftCellPos), doc.resolve(bottomRightCellPos));

    const state = EditorState.create({ schema, doc, selection });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    const merged = runRichTableOp(view, 'mergeCells');
    expect(merged).toBe(true);

    const afterMerge = findFirstTable(view.state.doc);
    expect(afterMerge).not.toBeNull();
    const tableAfterMerge = afterMerge!.node;
    const mapAfterMerge = TableMap.get(tableAfterMerge);
    const tableStartAfterMerge = afterMerge!.pos + 1;
    const mergedTopLeftPos = tableStartAfterMerge + mapAfterMerge.positionAt(0, 0, tableAfterMerge);
    const mergedTopLeftNode = view.state.doc.nodeAt(mergedTopLeftPos);
    expect(mergedTopLeftNode).not.toBeNull();

    const anchorText = cellTextWithBlockSep(mergedTopLeftNode);
    // 行优先顺序：a,b,c,d（允许中间用 \n 拼接）
    expect(anchorText).toContain('a');
    expect(anchorText).toContain('b');
    expect(anchorText).toContain('c');
    expect(anchorText).toContain('d');

    // splitCell 落点在合并单元格内
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, mergedTopLeftPos + 2)));
    const split = runRichTableOp(view, 'splitCell');
    expect(split).toBe(true);

    const afterSplit = findFirstTable(view.state.doc);
    expect(afterSplit).not.toBeNull();
    const tableAfterSplit = afterSplit!.node;
    const mapAfterSplit = TableMap.get(tableAfterSplit);
    const tableStartAfterSplit = afterSplit!.pos + 1;
    const topLeftAfterSplitPos = tableStartAfterSplit + mapAfterSplit.positionAt(0, 0, tableAfterSplit);
    const topLeftAfterSplitNode = view.state.doc.nodeAt(topLeftAfterSplitPos);
    expect(topLeftAfterSplitNode).not.toBeNull();

    const afterSplitText = cellTextWithBlockSep(topLeftAfterSplitNode);
    expect(afterSplitText).toContain('a');
    expect(afterSplitText).toContain('b');
    expect(afterSplitText).toContain('c');
    expect(afterSplitText).toContain('d');

    view.destroy();
    host.remove();
  });
});
