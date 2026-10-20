import { describe, expect, it } from 'vitest';
import { normalizeReaderPatch, readReaderPrefs } from './readerPrefs';

describe('readReaderPrefs', () => {
  it('没写过时默认开启选择即复制和自动换行', () => {
    expect(readReaderPrefs(undefined).copyOnSelect).toBe(true);
    expect(readReaderPrefs(undefined).wordWrap).toBe(true);
    expect(readReaderPrefs({ editor: { theme: 'auto' } }).copyOnSelect).toBe(true);
    expect(readReaderPrefs({ editor: { theme: 'auto' } }).wordWrap).toBe(true);
  });

  it('从 config.reader 读出关', () => {
    expect(readReaderPrefs({ reader: { copyOnSelect: false } }).copyOnSelect).toBe(false);
    expect(readReaderPrefs({ reader: { wordWrap: false } }).wordWrap).toBe(false);
  });

  it('主进程直接回传的对象也能读', () => {
    expect(readReaderPrefs({ copyOnSelect: false }).copyOnSelect).toBe(false);
    expect(readReaderPrefs({ copyOnSelect: true }).copyOnSelect).toBe(true);
  });

  it('非布尔值退回默认开', () => {
    expect(readReaderPrefs({ reader: { copyOnSelect: 'yes' } }).copyOnSelect).toBe(true);
    expect(readReaderPrefs({ reader: { copyOnSelect: 0 } }).copyOnSelect).toBe(true);
  });
});

describe('normalizeReaderPatch', () => {
  it('只收下布尔开关', () => {
    expect(normalizeReaderPatch({ copyOnSelect: false })).toEqual({ copyOnSelect: false });
    expect(normalizeReaderPatch({ copyOnSelect: true })).toEqual({ copyOnSelect: true });
    expect(normalizeReaderPatch({ wordWrap: false })).toEqual({ wordWrap: false });
    expect(normalizeReaderPatch({ wordWrap: true, copyOnSelect: false })).toEqual({
      wordWrap: true,
      copyOnSelect: false,
    });
  });

  it('缺字段或类型不对就当没改', () => {
    expect(normalizeReaderPatch(null)).toBeNull();
    expect(normalizeReaderPatch({})).toBeNull();
    expect(normalizeReaderPatch({ copyOnSelect: 'false' })).toBeNull();
    expect(normalizeReaderPatch({ wordWrap: 'no' })).toBeNull();
    expect(normalizeReaderPatch({ theme: 'nord' })).toBeNull();
  });
});
