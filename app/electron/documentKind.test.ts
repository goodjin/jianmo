import { describe, expect, it } from 'vitest';
import { isOpenableDocumentName, structuredKindFromName } from './documentKind';

describe('structuredKindFromName', () => {
  it('认 json / jsonl，大小写不敏感，jsonl 不会被当成 json', () => {
    expect(structuredKindFromName('data.json')).toBe('json');
    expect(structuredKindFromName('DATA.JSON')).toBe('json');
    expect(structuredKindFromName('C:\\docs\\rows.JSONL')).toBe('jsonl');
    expect(structuredKindFromName('/docs/rows.jsonl')).toBe('jsonl');
    expect(structuredKindFromName('notes.json.jsonl')).toBe('jsonl');
    expect(structuredKindFromName('notes.jsonl.json')).toBe('json');
  });

  it('Markdown 和其它类型不是结构化文档', () => {
    expect(structuredKindFromName('a.md')).toBeNull();
    expect(structuredKindFromName('a.markdown')).toBeNull();
    expect(structuredKindFromName('a.txt')).toBeNull();
    expect(structuredKindFromName('')).toBeNull();
    expect(structuredKindFromName('json')).toBeNull();
  });
});

describe('isOpenableDocumentName', () => {
  it('Markdown、JSON、JSONL 可打开，其它不行', () => {
    expect(isOpenableDocumentName('a.md')).toBe(true);
    expect(isOpenableDocumentName('A.MDX')).toBe(true);
    expect(isOpenableDocumentName('note.markdown')).toBe(true);
    expect(isOpenableDocumentName('/tmp/data.json')).toBe(true);
    expect(isOpenableDocumentName('rows.jsonl')).toBe(true);
    expect(isOpenableDocumentName('pic.png')).toBe(false);
    expect(isOpenableDocumentName('readme.txt')).toBe(false);
    expect(isOpenableDocumentName('')).toBe(false);
  });
});
