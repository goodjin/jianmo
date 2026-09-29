/**
 * 最近打开记录：纯函数，不碰 electron-store / fs。
 * 上限 100；同路径再次打开会置顶并刷新 openedAt。
 */

export const RECENT_FILES_LIMIT = 100;
export const DIR_MD_PAGE_SIZE = 100;

export interface RecentFileRecord {
  path: string;
  openedAt: number;
}

export function parseRecentFiles(raw: unknown): RecentFileRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentFileRecord[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const p = typeof rec.path === 'string' ? rec.path.trim() : '';
    const openedAt =
      typeof rec.openedAt === 'number' && Number.isFinite(rec.openedAt) ? rec.openedAt : 0;
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push({ path: p, openedAt });
  }
  return out.slice(0, RECENT_FILES_LIMIT);
}

export function upsertRecentFile(
  list: RecentFileRecord[],
  filePath: string,
  openedAt: number
): RecentFileRecord[] {
  const p = String(filePath ?? '').trim();
  if (!p) return parseRecentFiles(list);
  const rest = parseRecentFiles(list).filter((r) => r.path !== p);
  return [{ path: p, openedAt }, ...rest].slice(0, RECENT_FILES_LIMIT);
}

export function removeRecentFile(list: RecentFileRecord[], filePath: string): RecentFileRecord[] {
  const p = String(filePath ?? '').trim();
  return parseRecentFiles(list).filter((r) => r.path !== p);
}

export function paginateItems<T>(
  items: T[],
  offset: number,
  pageSize: number
): { items: T[]; hasMore: boolean; nextOffset: number } {
  const off = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const size = Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : 1));
  const slice = items.slice(off, off + size);
  return {
    items: slice,
    hasMore: off + slice.length < items.length,
    nextOffset: off + slice.length,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 记录上展示的打开时间：今天 / 昨天 / 今年月日 / 跨年完整日期。 */
export function formatOpenedAt(openedAt: number, nowMs: number = Date.now()): string {
  const d = new Date(openedAt);
  if (!Number.isFinite(openedAt) || Number.isNaN(d.getTime())) return '';
  const now = new Date(nowMs);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (sameCalendarDay(d, now)) return `今天 ${hm}`;
  const yest = new Date(nowMs);
  yest.setDate(yest.getDate() - 1);
  if (sameCalendarDay(d, yest)) return `昨天 ${hm}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`;
}

export function isMarkdownFileName(name: string): boolean {
  const lower = String(name ?? '').toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx');
}
