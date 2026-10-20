/**
 * 标签条挤不下时，左右按钮该不该出现。
 * 纯函数：不读 DOM。宽度差 1px 以内当成已经放得下，避免小数像素来回闪。
 */

export const TAB_MIN_WIDTH_PX = 120;
export const TAB_MAX_WIDTH_PX = 220;

export interface TabScrollEdges {
  left: boolean;
  right: boolean;
}

export function tabScrollEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): TabScrollEdges {
  if (!(clientWidth > 0) || !(scrollWidth > clientWidth + 1)) return { left: false, right: false };
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}
