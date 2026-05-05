/**
 * M52：同名图片文件名策略（扩展侧）；纯函数可与异步 stat 分离。
 */

export type ImageSameNameHandling = 'overwrite' | 'rename' | 'prompt';

export function splitStemExt(filename: string): { stem: string; ext: string } {
  const n = filename.lastIndexOf('.');
  if (n <= 0) return { stem: filename, ext: '' };
  return { stem: filename.slice(0, n), ext: filename.slice(n) };
}

/**
 * 在 `exists(name)` 为真时生成 `stem-2.ext`、`stem-3.ext`… 直到可用。
 * 若 `preferred` 本身可用，直接返回。
 */
export function pickNonConflictingFilename(
  preferred: string,
  exists: (name: string) => boolean
): string {
  if (!exists(preferred)) return preferred;
  const { stem, ext } = splitStemExt(preferred);
  let i = 2;
  let candidate = `${stem}-${i}${ext}`;
  while (exists(candidate)) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  return candidate;
}

/** 异步版：适用于扩展宿主 `workspace.fs.stat`。 */
export async function pickNonConflictingFilenameAsync(
  preferred: string,
  fileExists: (name: string) => Promise<boolean>
): Promise<string> {
  if (!(await fileExists(preferred))) return preferred;
  const { stem, ext } = splitStemExt(preferred);
  let i = 2;
  let candidate = `${stem}-${i}${ext}`;
  while (await fileExists(candidate)) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  return candidate;
}
