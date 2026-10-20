/**
 * 文件树占多宽。拖左边和右边之间的那条线时用这些纯函数，不碰界面。
 */

export const FILE_TREE_MIN_WIDTH = 160;
export const FILE_TREE_MAX_WIDTH = 560;
/** 和打开栏同一列。220 会把「打开」和旁边的按钮挤到标签上，所以默认 260。 */
export const FILE_TREE_DEFAULT_WIDTH = 260;
/** 右边预览至少留这么宽，避免文件树把正文挤没。 */
export const PREVIEW_MIN_WIDTH = 320;

export function fileTreeWidthLimit(available: number): { min: number; max: number } {
  const width =
    Number.isFinite(available) && available > 0
      ? available
      : FILE_TREE_MAX_WIDTH + PREVIEW_MIN_WIDTH;
  const room = Math.floor(width - PREVIEW_MIN_WIDTH);
  const max = Math.max(FILE_TREE_MIN_WIDTH, Math.min(FILE_TREE_MAX_WIDTH, room));
  return { min: FILE_TREE_MIN_WIDTH, max };
}

export function clampFileTreeWidth(width: number, available: number): number {
  const { min, max } = fileTreeWidthLimit(available);
  if (!Number.isFinite(width)) return Math.min(FILE_TREE_DEFAULT_WIDTH, max);
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function readStoredFileTreeWidth(raw: unknown, available: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return clampFileTreeWidth(raw, available);
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return clampFileTreeWidth(n, available);
  }
  return clampFileTreeWidth(FILE_TREE_DEFAULT_WIDTH, available);
}

/** 从按下的位置拖到现在。向右拉宽，向左收窄。 */
export function resizeDragMove(startWidth: number, startX: number, clientX: number, available: number): number {
  return clampFileTreeWidth(startWidth + (clientX - startX), available);
}
