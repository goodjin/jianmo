import { describe, expect, it } from 'vitest';
import { parseTrashResult, planTrash } from './trashFile';

describe('planTrash', () => {
  it('还在的文件可以移到废纸篓', () => {
    expect(planTrash('/docs/a.md', (p) => p === '/docs/a.md')).toEqual({
      ok: true,
      path: '/docs/a.md',
      error: '',
    });
  });

  it('空路径、文件夹和已经不在的文件都不删', () => {
    expect(planTrash('  ', () => true)).toEqual({ ok: false, path: '', error: '没有要删除的文件' });
    expect(planTrash('/docs', () => false)).toEqual({ ok: false, path: '/docs', error: '文件已经不在了' });
    expect(planTrash('/docs/gone.md', () => false)).toEqual({
      ok: false,
      path: '/docs/gone.md',
      error: '文件已经不在了',
    });
  });

  it('检查文件时出错，就当成文件已经不在', () => {
    expect(
      planTrash('/docs/a.md', () => {
        throw new Error('拒绝访问');
      })
    ).toEqual({ ok: false, path: '/docs/a.md', error: '文件已经不在了' });
  });
});

describe('parseTrashResult', () => {
  it('成功只留下路径', () => {
    expect(parseTrashResult({ ok: true, path: '/docs/a.md', error: '忽略' })).toEqual({
      ok: true,
      path: '/docs/a.md',
      error: '',
    });
  });

  it('失败留下说明；没有说明时用默认的一句', () => {
    expect(parseTrashResult({ ok: false, path: '/docs/a.md', error: ' 正在使用 ' })).toEqual({
      ok: false,
      path: '/docs/a.md',
      error: '正在使用',
    });
    expect(parseTrashResult(undefined)).toEqual({ ok: false, path: '', error: '无法移到废纸篓' });
  });
});
