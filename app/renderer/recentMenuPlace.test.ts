import { describe, expect, it } from 'vitest';
import { placeRecentMenu } from './recentMenuPlace';

describe('placeRecentMenu', () => {
  it('贴在打开按钮下沿，左边和按钮对齐', () => {
    expect(placeRecentMenu({ left: 16, bottom: 40 }, 1200)).toEqual({ top: 46, left: 16 });
  });

  it('靠右时往左收，菜单仍留在窗口里', () => {
    expect(placeRecentMenu({ left: 900, bottom: 40 }, 1000)).toEqual({ top: 46, left: 572 });
  });

  it('窗口比菜单窄时贴着左边留一点边', () => {
    expect(placeRecentMenu({ left: -20, bottom: 10 }, 300, 420)).toEqual({ top: 16, left: 8 });
  });
});
