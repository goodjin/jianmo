import { describe, it, expect } from 'vitest';
import {
  patternToRegExp,
  findAllMatchesInText,
  findFirstMatchAfter,
  findLastMatchBefore,
  matchOrdinalInText,
  type FindPatternMode,
} from '../findPattern';

function matches(
  text: string,
  pattern: string,
  patternMode: FindPatternMode,
  caseSensitive = false,
  wholeWord = false
) {
  const re = patternToRegExp(pattern, { caseSensitive, patternMode, wholeWord });
  if (!re) return [];
  return findAllMatchesInText(text, re).matches;
}

describe('findPattern', () => {
  it('literal 转义特殊字符', () => {
    expect(matches('a.b', '.', 'literal')).toEqual([{ from: 1, to: 2 }]);
    expect(matches('a.b', 'a.b', 'literal')).toEqual([{ from: 0, to: 3 }]);
  });

  it('glob: * 与 ?', () => {
    expect(matches('ping pong ping', 'p*g', 'glob')).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 9 },
      { from: 10, to: 14 },
    ]);
    expect(matches('abc ac', 'a?', 'glob')).toEqual([
      { from: 0, to: 2 },
      { from: 4, to: 6 },
    ]);
  });

  it('regex 模式', () => {
    expect(matches('aa ab', 'a+', 'regex')).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 4 },
    ]);
  });

  it('无效正则为 null 且无匹配', () => {
    expect(patternToRegExp('[', { patternMode: 'regex', caseSensitive: true })).toBeNull();
  });

  it('区分大小写', () => {
    expect(matches('Ping Ping', 'ping', 'literal', false)).toHaveLength(2);
    expect(matches('Ping Ping', 'ping', 'literal', true)).toHaveLength(0);
  });

  it('全字匹配：普通文本（Unicode \\b）', () => {
    expect(matches('test testing', 'test', 'literal', false, true)).toEqual([{ from: 0, to: 4 }]);
    expect(matches('test test', 'test', 'literal', false, true)).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 9 },
    ]);
    expect(matches('mytest x', 'test', 'literal', false, true)).toEqual([]);
  });

  it('全字匹配：正则模式（\\p 边界）', () => {
    // 「ab」前的单个 a 与后面的 b 相邻，不是整词；行末单独的 a 算一词
    expect(matches('aa ab a', 'a+', 'regex', false, true)).toEqual([
      { from: 0, to: 2 },
      { from: 6, to: 7 },
    ]);
  });

  it('maxResults 截断时 truncated 为 true', () => {
    const re = patternToRegExp('a', { caseSensitive: true, patternMode: 'literal' });
    expect(re).not.toBeNull();
    const { matches, truncated } = findAllMatchesInText('aaaa', re!, 2);
    expect(matches).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
    expect(truncated).toBe(true);
  });

  it('findFirstMatchAfter：严格在光标之后；无则回绕到第一个', () => {
    const re = patternToRegExp('a', { caseSensitive: true, patternMode: 'literal' });
    expect(re).not.toBeNull();
    expect(findFirstMatchAfter('aba', re!, 0, false)).toEqual({ from: 2, to: 3 });
    expect(findFirstMatchAfter('aba', re!, 2, false)).toBeNull();
    expect(findFirstMatchAfter('aba', re!, 2, true)).toEqual({ from: 0, to: 1 });
  });

  it('findLastMatchBefore：严格在光标之前；无则回绕到最后一个', () => {
    const re = patternToRegExp('a', { caseSensitive: true, patternMode: 'literal' });
    expect(re).not.toBeNull();
    expect(findLastMatchBefore('aba', re!, 2, false)).toEqual({ from: 0, to: 1 });
    expect(findLastMatchBefore('aba', re!, 0, false)).toBeNull();
    expect(findLastMatchBefore('aba', re!, 0, true)).toEqual({ from: 2, to: 3 });
  });

  it('matchOrdinalInText：与全量扫描顺序一致', () => {
    const re = patternToRegExp('ping', { caseSensitive: true, patternMode: 'literal' });
    expect(re).not.toBeNull();
    expect(matchOrdinalInText('ping pong ping', re!, { from: 0, to: 4 })).toBe(0);
    expect(matchOrdinalInText('ping pong ping', re!, { from: 10, to: 14 })).toBe(1);
  });
});
