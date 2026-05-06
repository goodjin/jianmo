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

  const joined = segments.join('/');
  // M181：Windows/macOS 默认文件系统常为大小写不敏感；用于“引用对比”时统一小写以降低误报
  // 注：这是“诊断键”，不用于真实文件访问。
  return joined.toLowerCase();
}
