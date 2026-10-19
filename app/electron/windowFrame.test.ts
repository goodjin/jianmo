import { describe, expect, it } from 'vitest';
import {
  clampIntoWorkArea,
  defaultWindowFrame,
  isCoveringSystemChrome,
  restoredFrame,
  type DisplayFrame,
  type Rect,
} from './windowFrame';

/** 菜单栏在上、程序坞在下的一块 Mac 屏幕。 */
const mac: DisplayFrame = {
  bounds: { x: 0, y: 0, width: 1512, height: 982 },
  workArea: { x: 0, y: 25, width: 1512, height: 882 },
};

const fitted: Rect = { x: 156, y: 66, width: 1200, height: 800 };
const stuck: Rect = { x: 0, y: 0, width: 1512, height: 982 };

describe('isCoveringSystemChrome', () => {
  it('顶到屏幕上沿、底到屏幕下沿，会挡住菜单栏和程序坞', () => {
    expect(isCoveringSystemChrome(stuck, mac)).toBe(true);
  });

  it('停在可见区域里的普通窗口不用改', () => {
    expect(isCoveringSystemChrome(fitted, mac)).toBe(false);
  });

  it('高度正常但顶进菜单栏时，关闭按钮点不到', () => {
    expect(isCoveringSystemChrome({ x: 100, y: 0, width: 1200, height: 800 }, mac)).toBe(true);
  });

  it('绿色按钮放大到可见区域时，标题栏仍在菜单栏下面', () => {
    expect(isCoveringSystemChrome({ x: 0, y: 25, width: 1512, height: 882 }, mac)).toBe(false);
  });

  it('没有菜单栏和程序坞时，铺满屏幕不算挡住', () => {
    const plain: DisplayFrame = {
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    };
    expect(isCoveringSystemChrome(plain.bounds, plain)).toBe(false);
  });
});

describe('defaultWindowFrame', () => {
  it('在可见区域里居中', () => {
    expect(defaultWindowFrame(mac.workArea)).toEqual(fitted);
  });

  it('屏幕比默认尺寸小时，缩进可见区域', () => {
    expect(defaultWindowFrame({ x: 10, y: 30, width: 800, height: 600 })).toEqual({
      x: 10,
      y: 30,
      width: 800,
      height: 600,
    });
  });
});

describe('clampIntoWorkArea', () => {
  it('探出菜单栏左侧的窗口被拉回可见区域', () => {
    expect(clampIntoWorkArea({ x: -40, y: 10, width: 1200, height: 800 }, mac.workArea)).toEqual({
      x: 0,
      y: 25,
      width: 1200,
      height: 800,
    });
  });
});

describe('restoredFrame', () => {
  it('铺满之后收回铺满之前的大小', () => {
    expect(restoredFrame(fitted, stuck, mac)).toEqual(fitted);
  });

  it('铺满之前就已经挡住时，改回默认大小', () => {
    expect(restoredFrame(stuck, stuck, mac)).toEqual(fitted);
  });

  it('普通窗口不改', () => {
    expect(restoredFrame(fitted, fitted, mac)).toBeNull();
  });
});
