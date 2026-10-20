import { describe, expect, it } from 'vitest';
import { TAB_MAX_WIDTH_PX, TAB_MIN_WIDTH_PX, tabScrollEdges } from './tabStrip';

describe('tabScrollEdges', () => {
  it('放得下时两边都不出现', () => {
    expect(tabScrollEdges(0, 400, 400)).toEqual({ left: false, right: false });
    expect(tabScrollEdges(0, 400, 401)).toEqual({ left: false, right: false });
  });

  it('宽度还没量到时不出现', () => {
    expect(tabScrollEdges(0, 0, 800)).toEqual({ left: false, right: false });
  });

  it('内容比窗口宽，停在最左时只出右边', () => {
    expect(tabScrollEdges(0, 200, 800)).toEqual({ left: false, right: true });
  });

  it('停在中间时两边都出', () => {
    expect(tabScrollEdges(100, 200, 800)).toEqual({ left: true, right: true });
  });

  it('滚到头时只出左边', () => {
    expect(tabScrollEdges(600, 200, 800)).toEqual({ left: true, right: false });
  });
});

describe('标签宽度', () => {
  it('最窄是固定的，最宽比最窄大', () => {
    expect(TAB_MIN_WIDTH_PX).toBe(120);
    expect(TAB_MAX_WIDTH_PX).toBeGreaterThan(TAB_MIN_WIDTH_PX);
  });
});
