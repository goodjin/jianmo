import { describe, expect, it } from 'vitest';
import {
  FILE_TREE_DEFAULT_WIDTH,
  FILE_TREE_MAX_WIDTH,
  FILE_TREE_MIN_WIDTH,
  clampFileTreeWidth,
  readStoredFileTreeWidth,
  resizeDragMove,
} from './fileTreeWidth';

const wide = 1400;

describe('clampFileTreeWidth', () => {
  it('普通宽度原样留下', () => {
    expect(clampFileTreeWidth(280, wide)).toBe(280);
  });

  it('太窄时停在最小宽度', () => {
    expect(clampFileTreeWidth(40, wide)).toBe(FILE_TREE_MIN_WIDTH);
  });

  it('太宽时停在最大宽度', () => {
    expect(clampFileTreeWidth(900, wide)).toBe(FILE_TREE_MAX_WIDTH);
  });

  it('窗口很窄时，不能把右边正文挤没', () => {
    expect(clampFileTreeWidth(500, 700)).toBe(380);
  });

  it('不是数字时用默认宽度', () => {
    expect(clampFileTreeWidth(Number.NaN, wide)).toBe(FILE_TREE_DEFAULT_WIDTH);
  });
});

describe('readStoredFileTreeWidth', () => {
  it('记住的数字会先收进允许范围', () => {
    expect(readStoredFileTreeWidth(300, wide)).toBe(300);
    expect(readStoredFileTreeWidth(900, wide)).toBe(FILE_TREE_MAX_WIDTH);
  });

  it('字符串数字也能读', () => {
    expect(readStoredFileTreeWidth(' 260 ', wide)).toBe(260);
  });

  it('空的或认不出的值回到默认宽度', () => {
    expect(readStoredFileTreeWidth(undefined, wide)).toBe(FILE_TREE_DEFAULT_WIDTH);
    expect(readStoredFileTreeWidth('', wide)).toBe(FILE_TREE_DEFAULT_WIDTH);
    expect(readStoredFileTreeWidth('宽', wide)).toBe(FILE_TREE_DEFAULT_WIDTH);
  });
});

describe('resizeDragMove', () => {
  it('向右拖变宽，向左拖变窄', () => {
    expect(resizeDragMove(220, 100, 160, wide)).toBe(280);
    expect(resizeDragMove(220, 100, 40, wide)).toBe(FILE_TREE_MIN_WIDTH);
  });

  it('拖过上限就停在上限', () => {
    expect(resizeDragMove(500, 0, 400, wide)).toBe(FILE_TREE_MAX_WIDTH);
  });
});
