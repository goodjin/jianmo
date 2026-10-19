/**
 * 窗口位置。macOS 把窗口拉去「所有桌面」时，有时会把窗口拉成整块屏幕那么大，
 * 但并没有真正进入全屏：标题栏钻进菜单栏，底部钻进程序坞，关闭和缩小都点不到。
 * 这里只根据矩形判断，不依赖 Electron。
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayFrame {
  /** 整块屏幕，含菜单栏和程序坞。 */
  bounds: Rect;
  /** 菜单栏下面、程序坞上面的可见区域。 */
  workArea: Rect;
}

export const DEFAULT_WINDOW_WIDTH = 1200;
export const DEFAULT_WINDOW_HEIGHT = 800;

export function isCoveringSystemChrome(frame: Rect, display: DisplayFrame): boolean {
  const screen = display.bounds;
  const work = display.workArea;
  const menuBar = work.y - screen.y;
  const verticalChrome = screen.height - work.height;
  if (menuBar <= 1 && verticalChrome <= 1) return false;
  // 红绿灯在窗口顶上大约 16px。整条都埋进菜单栏就点不到关闭和缩小。
  if (menuBar > 1 && frame.y + 16 <= work.y) return true;
  const startsAtScreenTop = frame.y <= screen.y + 2;
  const reachesScreenBottom = frame.y + frame.height >= screen.y + screen.height - 2;
  const almostAsTallAsScreen = frame.height >= screen.height - 8;
  const overflowsWork = frame.y < work.y - 1 || frame.y + frame.height > work.y + work.height + 1;
  return startsAtScreenTop && reachesScreenBottom && almostAsTallAsScreen && overflowsWork;
}

/** 放进可见区域里居中。屏幕比默认尺寸小的时候，就缩到可见区域那么大。 */
export function defaultWindowFrame(
  workArea: Rect,
  width = DEFAULT_WINDOW_WIDTH,
  height = DEFAULT_WINDOW_HEIGHT
): Rect {
  const w = Math.max(1, Math.min(width, workArea.width));
  const h = Math.max(1, Math.min(height, workArea.height));
  return {
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + (workArea.height - h) / 2),
    width: Math.round(w),
    height: Math.round(h),
  };
}

/** 宽高不超过可见区域，整窗留在菜单栏和程序坞之间。 */
export function clampIntoWorkArea(frame: Rect, workArea: Rect): Rect {
  const width = Math.max(1, Math.min(Math.round(frame.width), workArea.width));
  const height = Math.max(1, Math.min(Math.round(frame.height), workArea.height));
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  return {
    x: Math.round(Math.min(Math.max(frame.x, workArea.x), maxX)),
    y: Math.round(Math.min(Math.max(frame.y, workArea.y), maxY)),
    width,
    height,
  };
}

/**
 * 窗口若铺满整屏却没进真正的全屏，就收回。
 * 之前的大小还在可见区域里，就用之前的；否则用默认大小。
 * 返回 null 表示不用改。
 */
export function restoredFrame(before: Rect | null, after: Rect, display: DisplayFrame): Rect | null {
  if (!isCoveringSystemChrome(after, display)) return null;
  if (before && !isCoveringSystemChrome(before, display)) {
    return clampIntoWorkArea(before, display.workArea);
  }
  return defaultWindowFrame(display.workArea);
}
