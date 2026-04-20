import { describe, expect, it } from 'vitest';
import {
  MARKLY_TABLE_PASTE_MAX_COLS,
  MARKLY_TABLE_PASTE_MAX_ROWS,
  parseHtmlTableToGrid,
  parseCsvLine,
  parseCsvLineStrict,
  parseDelimitedGridForTablePaste,
} from '../markly-table-rich';

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
