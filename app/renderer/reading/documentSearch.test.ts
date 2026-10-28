import { describe, expect, it } from 'vitest';
import {
  SEARCH_RESULT,
  emptySearchUi,
  emptyTabSearch,
  readSearchResult,
  documentSearchRuntimeSource,
} from './documentSearch';

describe('documentSearch', () => {
  it('空状态可复用', () => {
    expect(emptySearchUi()).toEqual({ open: false, query: '', matchCount: 0, activeIndex: -1 });
    expect(emptyTabSearch()).toEqual({ open: false, query: '', activeIndex: -1 });
  });

  it('读出搜索结果消息', () => {
    expect(readSearchResult(null)).toBeNull();
    expect(readSearchResult({ type: SEARCH_RESULT, matchCount: 3, activeIndex: 1 })).toEqual({
      matchCount: 3,
      activeIndex: 1,
    });
    expect(readSearchResult({ type: SEARCH_RESULT, matchCount: -2, activeIndex: 0.8 })).toEqual({
      matchCount: 0,
      activeIndex: 0,
    });
  });

  it('运行时脚本包含消息类型与高亮类名', () => {
    const src = documentSearchRuntimeSource();
    expect(src).toContain('MARKLY_SEARCH_FIND');
    expect(src).toContain('markly-search-hit');
    expect(src).toContain('is-current');
  });
});
