import { describe, expect, it, vi } from 'vitest';
import {
  applyFileRename,
  destinationTaken,
  parseRenameResult,
  planRename,
} from './fileRename';

describe('planRename', () => {
  it('同名不改路径', () => {
    const taken = vi.fn(() => true);
    expect(planRename('/docs/a.md', 'a.md', taken)).toEqual({
      ok: true,
      from: '/docs/a.md',
      to: '/docs/a.md',
      unchanged: true,
    });
    expect(taken).not.toHaveBeenCalled();
  });

  it('拼出同目录下的新路径', () => {
    expect(planRename('/docs/notes/b.md', 'c.md', () => false)).toEqual({
      ok: true,
      from: '/docs/notes/b.md',
      to: '/docs/notes/c.md',
      unchanged: false,
    });
  });

  it('根目录上的文件仍留在根上', () => {
    expect(planRename('/a.md', 'b.md', () => false)).toEqual({
      ok: true,
      from: '/a.md',
      to: '/b.md',
      unchanged: false,
    });
  });

  it('Windows 路径用反斜杠拼接', () => {
    expect(planRename('C:\\docs\\a.md', 'b.md', () => false)).toEqual({
      ok: true,
      from: 'C:\\docs\\a.md',
      to: 'C:\\docs\\b.md',
      unchanged: false,
    });
    expect(planRename('C:\\a.md', 'b.md', () => false)).toMatchObject({ to: 'C:\\b.md' });
  });

  it('空名、点、斜杠都拒绝', () => {
    expect(planRename('/docs/a.md', '   ', () => false)).toEqual({ ok: false, error: '文件名无效' });
    expect(planRename('/docs/a.md', '.', () => false)).toEqual({ ok: false, error: '文件名无效' });
    expect(planRename('/docs/a.md', '..', () => false)).toEqual({ ok: false, error: '文件名无效' });
    expect(planRename('/docs/a.md', 'a/b.md', () => false)).toEqual({ ok: false, error: '文件名不能包含斜杠' });
    expect(planRename('/docs/a.md', 'a\\b.md', () => false)).toEqual({ ok: false, error: '文件名不能包含斜杠' });
  });

  it('目标已被占用时不给出新路径', () => {
    expect(planRename('/docs/a.md', 'b.md', () => true)).toEqual({ ok: false, error: '已有同名文件' });
  });

  it('没有原路径时直接失败', () => {
    expect(planRename('   ', 'a.md', () => false)).toEqual({ ok: false, error: '找不到原文件' });
  });
});

describe('destinationTaken', () => {
  it('目标不存在则可以占用', () => {
    expect(destinationTaken('/docs/a.md', '/docs/b.md', () => false, () => false)).toBe(false);
  });

  it('另一个文件占着这个名字', () => {
    expect(destinationTaken('/docs/A.md', '/docs/a.md', () => true, () => false)).toBe(true);
  });

  it('只是同一个文件的大小写不同，不算占用', () => {
    expect(destinationTaken('/docs/A.md', '/docs/a.md', () => true, () => true)).toBe(false);
  });

  it('查磁盘失败时当作已被占用，避免盖掉别人的文件', () => {
    expect(
      destinationTaken(
        '/docs/a.md',
        '/docs/b.md',
        () => {
          throw new Error('boom');
        },
        () => false
      )
    ).toBe(true);
    expect(destinationTaken('/docs/a.md', '/docs/b.md', () => true, () => {
      throw new Error('realpath');
    })).toBe(true);
  });
});

describe('applyFileRename', () => {
  it('改名时调用磁盘改名', () => {
    const rename = vi.fn();
    const result = applyFileRename('/docs/a.md', 'b.md', {
      taken: () => false,
      isFile: () => true,
      rename,
    });
    expect(result).toEqual({ ok: true, from: '/docs/a.md', to: '/docs/b.md', unchanged: false });
    expect(rename).toHaveBeenCalledWith('/docs/a.md', '/docs/b.md');
  });

  it('同名、重名、找不到文件时都不改磁盘', () => {
    const rename = vi.fn();
    expect(
      applyFileRename('/docs/a.md', 'a.md', { taken: () => false, isFile: () => true, rename }).ok
    ).toBe(true);
    expect(applyFileRename('/docs/a.md', 'b.md', { taken: () => true, isFile: () => true, rename })).toEqual({
      ok: false,
      error: '已有同名文件',
    });
    expect(applyFileRename('/docs/a.md', 'b.md', { taken: () => false, isFile: () => false, rename })).toEqual({
      ok: false,
      error: '找不到原文件',
    });
    expect(rename).not.toHaveBeenCalled();
  });

  it('磁盘改名失败时把错误原文交回去', () => {
    const result = applyFileRename('/docs/a.md', 'b.md', {
      taken: () => false,
      isFile: () => true,
      rename: () => {
        throw new Error('系统不允许读取「文稿」。');
      },
    });
    expect(result).toEqual({ ok: false, error: '系统不允许读取「文稿」。' });
  });
});

describe('parseRenameResult', () => {
  it('成功时只留路径', () => {
    expect(parseRenameResult({ ok: true, path: '/docs/b.md', error: '忽略' })).toEqual({
      ok: true,
      path: '/docs/b.md',
      error: '',
    });
  });

  it('失败、空包都有一句说明', () => {
    expect(parseRenameResult({ ok: false, error: '已有同名文件' })).toEqual({
      ok: false,
      path: '',
      error: '已有同名文件',
    });
    expect(parseRenameResult(null)).toEqual({ ok: false, path: '', error: '重命名失败' });
    expect(parseRenameResult({ ok: false })).toEqual({ ok: false, path: '', error: '重命名失败' });
  });
});
