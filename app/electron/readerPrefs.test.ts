import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_OPEN_TABS, MAX_MAX_OPEN_TABS, normalizeReaderPatch, readReaderPrefs } from './readerPrefs';

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

  it('没写过标签上限时用默认值', () => {
    expect(readReaderPrefs(undefined).maxOpenTabs).toBe(DEFAULT_MAX_OPEN_TABS);
    expect(readReaderPrefs({ reader: { copyOnSelect: false } }).maxOpenTabs).toBe(DEFAULT_MAX_OPEN_TABS);
  });

  it('标签上限会收进允许的范围', () => {
    expect(readReaderPrefs({ reader: { maxOpenTabs: 8 } }).maxOpenTabs).toBe(8);
    expect(readReaderPrefs({ maxOpenTabs: 0 }).maxOpenTabs).toBe(1);
    expect(readReaderPrefs({ maxOpenTabs: 99 }).maxOpenTabs).toBe(MAX_MAX_OPEN_TABS);
    expect(readReaderPrefs({ maxOpenTabs: 7.6 }).maxOpenTabs).toBe(8);
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
    expect(normalizeReaderPatch({ maxOpenTabs: '12' })).toBeNull();
  });

  it('标签上限单独也能改，过大过小会收进范围', () => {
    expect(normalizeReaderPatch({ maxOpenTabs: 12 })).toEqual({ maxOpenTabs: 12 });
    expect(normalizeReaderPatch({ maxOpenTabs: 0 })).toEqual({ maxOpenTabs: 1 });
    expect(normalizeReaderPatch({ maxOpenTabs: 80 })).toEqual({ maxOpenTabs: MAX_MAX_OPEN_TABS });
    expect(normalizeReaderPatch({ copyOnSelect: false, maxOpenTabs: 6 })).toEqual({
      copyOnSelect: false,
      maxOpenTabs: 6,
    });
  });
});
