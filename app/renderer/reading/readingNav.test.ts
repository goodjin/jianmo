import { describe, expect, it } from 'vitest';
import {
  canNavBack,
  canNavForward,
  emptyNavState,
  entryFromAnchor,
  navBack,
  navForward,
  pushNavJump,
  readNavJump,
  NAV_JUMP,
} from './readingNav';

describe('readingNav', () => {
  it('空栈不能前进后退', () => {
    const s = emptyNavState();
    expect(canNavBack(s)).toBe(false);
    expect(canNavForward(s)).toBe(false);
  });

  it('跳转后可后退再前进', () => {
    const from = entryFromAnchor({ snippet: '甲', ratio: 0.1 }, 'restore');
    const to = entryFromAnchor({ snippet: '乙', ratio: 0.5 }, 'outline');
    let state = pushNavJump(emptyNavState(), from, to);
    expect(canNavBack(state)).toBe(true);
    expect(canNavForward(state)).toBe(false);
    const back = navBack(state);
    expect(back.entry?.snippet).toBe('甲');
    state = back.state;
    expect(canNavForward(state)).toBe(true);
    const fwd = navForward(state);
    expect(fwd.entry?.snippet).toBe('乙');
  });

  it('读出导航跳转消息', () => {
    expect(readNavJump({ type: NAV_JUMP, snippet: 'x', ratio: 0.2, reason: 'anchor' })).toEqual({
      snippet: 'x',
      ratio: 0.2,
      reason: 'anchor',
    });
  });
});
