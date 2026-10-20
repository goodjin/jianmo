import { describe, expect, it } from 'vitest';
import { editingOriginalNote, formatDocumentSource, sourceFormatNote } from './sourceText';

describe('formatDocumentSource', () => {
  it('Markdown 原样显示，就算正文看起来像 JSON 也不排版', () => {
    const raw = '{"a":1}\n\n# 标题';
    expect(formatDocumentSource(raw, '/docs/a.md')).toBe(raw);
    expect(formatDocumentSource(raw, 'note.markdown')).toBe(raw);
    expect(formatDocumentSource(raw, '')).toBe(raw);
  });

  it('JSON 排成两空格缩进，键的顺序和中文都留着', () => {
    expect(formatDocumentSource('{"名字":"雪","n":1,"ok":false,"tags":["a",{"id":2}]}', 'C:\\docs\\a.JSON')).toBe(
      '{\n  "名字": "雪",\n  "n": 1,\n  "ok": false,\n  "tags": [\n    "a",\n    {\n      "id": 2\n    }\n  ]\n}'
    );
  });

  it('JSON 前后空白不影响排版，解析不了就显示原文', () => {
    expect(formatDocumentSource('  {"a":1}\n', '/docs/a.json')).toBe('{\n  "a": 1\n}');
    expect(formatDocumentSource('{', '/docs/a.json')).toBe('{');
    expect(formatDocumentSource('{"a":1}{"b":2}', '/docs/a.json')).toBe('{"a":1}{"b":2}');
    expect(formatDocumentSource('', '/docs/a.json')).toBe('');
  });

  it('JSON 开头的 BOM 去掉后再排版', () => {
    expect(formatDocumentSource('\uFEFF{"a":1}', '/docs/a.json')).toBe('{\n  "a": 1\n}');
  });

  it('JSONL 每一行单独排开，中间空一行，空行跳过', () => {
    const raw = '{"a":1}\r\n\r\n"hi"\n{"b":[1,2]}\n';
    expect(formatDocumentSource(raw, '/docs/rows.jsonl')).toBe(
      '{\n  "a": 1\n}\n\n"hi"\n\n{\n  "b": [\n    1,\n    2\n  ]\n}'
    );
  });

  it('JSONL 里解析失败的那一行原样留下，其余继续排版', () => {
    expect(formatDocumentSource('{"a":1}\nnot json\n{"b":2}\n', 'notes.json.jsonl')).toBe(
      '{\n  "a": 1\n}\n\nnot json\n\n{\n  "b": 2\n}'
    );
  });

  it('JSONL 全是空行时显示原文，BOM 只影响解析', () => {
    expect(formatDocumentSource(' \n\n ', '/docs/rows.JSONL')).toBe(' \n\n ');
    expect(formatDocumentSource('\uFEFF{"a":1}\n', '/docs/rows.jsonl')).toBe('{\n  "a": 1\n}');
  });

  it('名字以 .json 结尾但实际是 .jsonl 的，按 JSONL 排', () => {
    expect(formatDocumentSource('{"a":1}\n{"b":2}', '/docs/notes.json.jsonl')).toBe(
      '{\n  "a": 1\n}\n\n{\n  "b": 2\n}'
    );
  });
});

describe('sourceFormatNote', () => {
  it('Markdown 和能排版的 JSON / JSONL 不提示', () => {
    expect(sourceFormatNote('{"a":1}', '/docs/a.md')).toBe('');
    expect(sourceFormatNote('{"a":1}', '/docs/a.json')).toBe('');
    expect(sourceFormatNote('{"a":1}\n{"b":2}\n', '/docs/rows.jsonl')).toBe('');
    expect(sourceFormatNote(' \n ', '/docs/rows.jsonl')).toBe('');
  });

  it('整份排不了，和只有部分行排不了，说法不一样', () => {
    expect(sourceFormatNote('{', '/docs/a.json')).toBe('这份 JSON 没法排成缩进，下面是原文。');
    expect(sourceFormatNote('nope\nalso\n', '/docs/rows.jsonl')).toBe('这些行没法排成缩进，下面是原文。');
    expect(sourceFormatNote('{"a":1}\nnope\n', '/docs/rows.jsonl')).toBe(
      '有的行没法排成缩进，那些行按原文留下。'
    );
  });
});

describe('editingOriginalNote', () => {
  it('JSON 和 JSONL 提醒正在改原文，Markdown 不说', () => {
    expect(editingOriginalNote('/docs/a.json')).toBe('正在编辑文件原文，不是排版后的样子。');
    expect(editingOriginalNote('rows.JSONL')).toBe('正在编辑文件原文，不是排版后的样子。');
    expect(editingOriginalNote('/docs/a.md')).toBe('');
    expect(editingOriginalNote('')).toBe('');
  });
});
