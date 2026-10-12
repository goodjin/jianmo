import { describe, expect, it } from 'vitest';
import {
  ancestorDirs,
  canGoToParent,
  filesystemRootOf,
  isPathUnderRoot,
  parentDir,
  parseFileTreeResult,
  resolveFileTreeRoot,
  FILE_TREE_ERR_UNREADABLE,
} from './fileTreeModel';

describe('fileTreeModel', () => {
  it('前缀相同但不是子路径时不算在根下', () => {
    expect(isPathUnderRoot('/docs', '/docs/a.md')).toBe(true);
    expect(isPathUnderRoot('/docs', '/docs')).toBe(true);
    expect(isPathUnderRoot('/docs', '/docs-other/a.md')).toBe(false);
    expect(isPathUnderRoot('', '/docs')).toBe(false);
  });

  it('文件系统根不能再向上，其它目录可以', () => {
    expect(canGoToParent('/')).toBe(false);
    expect(canGoToParent('C:\\')).toBe(false);
    expect(canGoToParent('/home/me')).toBe(true);
    expect(canGoToParent('/home')).toBe(true);
    expect(parentDir('/home/me')).toBe('/home');
  });

  it('没记住目录时用用户主目录，记住的目录还在就优先用它', () => {
    const exists = (dir: string) => dir === '/home/me' || dir === '/work';
    expect(resolveFileTreeRoot('', '/home/me', exists)).toBe('/home/me');
    expect(resolveFileTreeRoot('/work', '/home/me', exists)).toBe('/work');
    expect(resolveFileTreeRoot('/gone', '/home/me', exists)).toBe('/home/me');
    expect(resolveFileTreeRoot('/gone', '/missing', exists)).toBe('');
  });

  it('parentDir 去掉最后一段，根上的文件回到根', () => {
    expect(parentDir('/docs/sub/a.md')).toBe('/docs/sub');
    expect(parentDir('/a.md')).toBe('/');
    expect(parentDir('')).toBe('');
    expect(parentDir('C:\\docs\\a.md')).toBe('C:\\docs');
  });

  it('ancestorDirs 只给出根与文件之间的目录', () => {
    expect(ancestorDirs('/docs', '/docs/a.md')).toEqual([]);
    expect(ancestorDirs('/', '/docs/notes/b.md')).toEqual(['/docs', '/docs/notes']);
    expect(ancestorDirs('/docs', '/docs/sub/nested/a.md')).toEqual(['/docs/sub', '/docs/sub/nested']);
    expect(ancestorDirs('/docs', '/other/a.md')).toEqual([]);
    expect(ancestorDirs('/docs', '/docs-other/a.md')).toEqual([]);
    expect(ancestorDirs('C:\\docs', 'C:\\docs\\sub\\a.md')).toEqual(['C:\\docs\\sub']);
  });

  it('filesystemRootOf 给出路径所属的文件系统根', () => {
    expect(filesystemRootOf('/Users/good/a.md')).toBe('/');
    expect(filesystemRootOf('/a.md')).toBe('/');
    expect(filesystemRootOf('C:\\Users\\a.md')).toBe('C:\\');
    expect(filesystemRootOf('d:/work/a.md')).toBe('D:\\');
    expect(filesystemRootOf('相对路径/a.md')).toBe('');
    expect(filesystemRootOf('')).toBe('');
  });

  it('以文件系统根为树根时分隔符不叠加', () => {
    expect(isPathUnderRoot('/', '/docs/a.md')).toBe(true);
    expect(isPathUnderRoot('C:\\', 'C:\\docs\\a.md')).toBe(true);
    expect(isPathUnderRoot('C:\\', 'D:\\docs\\a.md')).toBe(false);
    expect(ancestorDirs('C:\\', 'C:\\docs\\notes\\a.md')).toEqual(['C:\\docs', 'C:\\docs\\notes']);
    expect(ancestorDirs('C:\\', 'C:\\a.md')).toEqual([]);
    expect(parentDir('C:\\a.md')).toBe('C:\\');
  });

  it('parseFileTreeResult 丢掉残缺项', () => {
    const page = parseFileTreeResult({
      dir: '/docs',
      error: '',
      entries: [
        { name: 'a.md', path: '/docs/a.md', kind: 'file' },
        { name: ' ', path: '/docs/x', kind: 'dir' },
        { name: 'notes', path: '/docs/notes', kind: 'folder' },
        null,
      ],
    });
    expect(page.dir).toBe('/docs');
    expect(page.entries).toEqual([{ name: 'a.md', path: '/docs/a.md', kind: 'file' }]);
    expect(parseFileTreeResult(null).error).toBe(FILE_TREE_ERR_UNREADABLE);
  });
});
