import { describe, expect, it } from 'vitest';
import {
  DIR_MD_PAGE_SIZE,
  RECENT_FILES_LIMIT,
  formatOpenedAt,
  isMarkdownFileName,
  paginateItems,
  parseRecentFiles,
  removeRecentFile,
  upsertRecentFile,
} from './recentFiles';

describe('parseRecentFiles', () => {
  it('丢掉非法项、去重、截到 100', () => {
    const raw = [
      { path: ' /a.md ', openedAt: 10 },
      { path: '/a.md', openedAt: 99 },
      { path: '', openedAt: 1 },
      { openedAt: 2 },
      null,
      { path: '/b.md', openedAt: 'x' },
      ...Array.from({ length: 120 }, (_, i) => ({ path: `/n${i}.md`, openedAt: i })),
    ];
    const list = parseRecentFiles(raw);
    expect(list[0]).toEqual({ path: '/a.md', openedAt: 10 });
    expect(list.some((r) => r.path === '/b.md' && r.openedAt === 0)).toBe(true);
    expect(list.length).toBe(RECENT_FILES_LIMIT);
    expect(list[list.length - 1]?.path).not.toBe('/n119.md');
  });

  it('非数组 → []', () => {
    expect(parseRecentFiles(undefined)).toEqual([]);
    expect(parseRecentFiles({ path: '/a.md' })).toEqual([]);
  });
});

describe('upsertRecentFile', () => {
  it('新路径插到最前', () => {
    const next = upsertRecentFile([{ path: '/old.md', openedAt: 1 }], '/new.md', 9);
    expect(next[0]).toEqual({ path: '/new.md', openedAt: 9 });
    expect(next[1]).toEqual({ path: '/old.md', openedAt: 1 });
  });

  it('已存在则置顶并刷新 openedAt', () => {
    const next = upsertRecentFile(
      [
        { path: '/a.md', openedAt: 1 },
        { path: '/b.md', openedAt: 2 },
      ],
      '/b.md',
      50
    );
    expect(next).toEqual([
      { path: '/b.md', openedAt: 50 },
      { path: '/a.md', openedAt: 1 },
    ]);
  });

  it('超过 100 丢掉最旧（队尾）', () => {
    const full = Array.from({ length: RECENT_FILES_LIMIT }, (_, i) => ({
      path: `/f${i}.md`,
      openedAt: i,
    }));
    const next = upsertRecentFile(full, '/fresh.md', 999);
    expect(next).toHaveLength(RECENT_FILES_LIMIT);
    expect(next[0]).toEqual({ path: '/fresh.md', openedAt: 999 });
    expect(next.some((r) => r.path === '/f99.md')).toBe(false);
  });

  it('空路径不改列表', () => {
    const prev = [{ path: '/a.md', openedAt: 1 }];
    expect(upsertRecentFile(prev, '  ', 2)).toEqual(prev);
  });
});

describe('removeRecentFile', () => {
  it('按 path 删除一条，其它保留', () => {
    const next = removeRecentFile(
      [
        { path: '/a.md', openedAt: 1 },
        { path: '/b.md', openedAt: 2 },
      ],
      '/a.md'
    );
    expect(next).toEqual([{ path: '/b.md', openedAt: 2 }]);
  });
});

describe('paginateItems', () => {
  it('默认页大小语义：100 条一页，hasMore 指向下一批', () => {
    expect(DIR_MD_PAGE_SIZE).toBe(100);
    const items = Array.from({ length: 250 }, (_, i) => i);
    const p1 = paginateItems(items, 0, DIR_MD_PAGE_SIZE);
    expect(p1.items).toHaveLength(100);
    expect(p1.items[0]).toBe(0);
    expect(p1.items[99]).toBe(99);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextOffset).toBe(100);
    const p2 = paginateItems(items, p1.nextOffset, DIR_MD_PAGE_SIZE);
    expect(p2.items[0]).toBe(100);
    expect(p2.hasMore).toBe(true);
    const p3 = paginateItems(items, p2.nextOffset, DIR_MD_PAGE_SIZE);
    expect(p3.items).toHaveLength(50);
    expect(p3.hasMore).toBe(false);
  });
});

describe('formatOpenedAt', () => {
  const now = Date.parse('2026-09-12T15:04:00');

  it('同一天显示 今天 HH:mm', () => {
    expect(formatOpenedAt(Date.parse('2026-09-12T08:05:00'), now)).toBe('今天 08:05');
  });

  it('昨天显示 昨天 HH:mm', () => {
    expect(formatOpenedAt(Date.parse('2026-09-11T23:59:00'), now)).toBe('昨天 23:59');
  });

  it('今年更早显示 月日', () => {
    expect(formatOpenedAt(Date.parse('2026-01-03T09:00:00'), now)).toBe('1月3日 09:00');
  });

  it('跨年显示 YYYY-MM-DD', () => {
    expect(formatOpenedAt(Date.parse('2025-12-31T01:02:00'), now)).toBe('2025-12-31 01:02');
  });

  it('非法时间戳返回空串', () => {
    expect(formatOpenedAt(Number.NaN, now)).toBe('');
  });
});

describe('isMarkdownFileName', () => {
  it('识别 md / markdown / mdx，大小写不敏感', () => {
    expect(isMarkdownFileName('a.md')).toBe(true);
    expect(isMarkdownFileName('A.MD')).toBe(true);
    expect(isMarkdownFileName('n.markdown')).toBe(true);
    expect(isMarkdownFileName('x.mdx')).toBe(true);
    expect(isMarkdownFileName('a.txt')).toBe(false);
    expect(isMarkdownFileName('md')).toBe(false);
  });
});
