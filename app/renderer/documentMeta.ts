/** 从绝对路径拆出标题栏要用的文件名；无路径时两者都为空。 */
export function displayNameFromPath(filePath: string | null | undefined): {
  filePath: string;
  fileName: string;
} {
  const p = typeof filePath === 'string' ? filePath.trim() : '';
  if (!p) return { filePath: '', fileName: '' };
  const parts = p.split(/[/\\]/).filter(Boolean);
  const fileName = parts[parts.length - 1] ?? p;
  return { filePath: p, fileName };
}

/** 去掉文件名后的目录路径，供历史记录第二行展示。 */
export function displayDirFromPath(filePath: string | null | undefined): string {
  const { filePath: p, fileName } = displayNameFromPath(filePath);
  if (!p || !fileName || p === fileName) return '';
  const cut = p.length - fileName.length;
  return p.slice(0, cut).replace(/[/\\]+$/, '');
}
