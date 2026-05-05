import { describe, expect, it } from 'vitest';
import {
  buildGfmMarkdownTable,
  escapeGfmCell,
  looksLikeGfmTable,
  rowsFromSimpleCsv,
  rowsFromTsv,
  tryMockConvertDelimitedTextToGfmTable,
  unwrapMarkdownFence,
} from '../ai/textToGfmTable';

describe('textToGfmTable helpers', () => {
  it('escapes pipes and backslashes inside cells', () => {
    expect(escapeGfmCell('a|b')).toBe('a\\|b');
    expect(escapeGfmCell('x\\y')).toBe('x\\\\y');
  });

  it('parses TSV when all rows share the same column count', () => {
    const rows = rowsFromTsv('H1\tH2\nV1\tV2\n');
    expect(rows).toEqual([
      ['H1', 'H2'],
      ['V1', 'V2'],
    ]);
  });

  it('parses simple CSV when no tabs are present', () => {
    const rows = rowsFromSimpleCsv('H1,H2\nV1,V2\n');
    expect(rows).toEqual([
      ['H1', 'H2'],
      ['V1', 'V2'],
    ]);
  });

  it('builds a GFM table with a separator row', () => {
    const md = buildGfmMarkdownTable([
      ['A', 'B'],
      ['1', '2'],
    ]);
    expect(looksLikeGfmTable(md)).toBe(true);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| 1 | 2 |');
  });

  it('mock converter turns TSV into GFM', () => {
    const out = tryMockConvertDelimitedTextToGfmTable('Col1\tCol2\na\tb\n');
    expect(out).toBeTruthy();
    expect(looksLikeGfmTable(String(out))).toBe(true);
  });

  it('unwrapMarkdownFence strips a single markdown fence', () => {
    expect(unwrapMarkdownFence('```markdown\n| a |\n|---|\n| b |\n```')).toContain('| a |');
  });
});
