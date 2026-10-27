/** 最近打开菜单贴在「打开」下面。靠右时往左收，避免画出窗口。 */
export function placeRecentMenu(
  anchor: { left: number; bottom: number },
  viewportWidth: number,
  menuWidth = 420
): { top: number; left: number } {
  const gap = 6;
  const pad = 8;
  const width = Math.min(menuWidth, Math.max(0, viewportWidth - pad * 2));
  let left = anchor.left;
  const maxLeft = viewportWidth - width - pad;
  if (left > maxLeft) left = maxLeft;
  if (left < pad) left = pad;
  const bottom = Number.isFinite(anchor.bottom) ? anchor.bottom : 0;
  return { top: bottom + gap, left };
}
