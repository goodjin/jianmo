/**
 * M53：Markdown 正文里本地路径与宿主返回的文档相对路径做同一套规范化，便于比较「是否引用」。
 */
export function canonicalMarkdownLocalRefKey(raw: string): string {
  let s = String(raw ?? '').trim();
  const q = s.split(/[?#]/)[0];
  if (q !== undefined) s = q;
  try {
    s = decodeURIComponent(s.replace(/\\/g, '/'));
  } catch {
    s = s.replace(/\\/g, '/');
  }

  const segments: string[] = [];
  for (const p of s.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') {
      segments.pop();
      continue;
    }
    segments.push(p);
  }

  return segments.join('/');
}
