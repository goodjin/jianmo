import { describe, expect, it } from 'vitest';
import { openDialogProperties, splitOpenSelection } from './openSelection';

function dirs(...paths: string[]): (filePath: string) => boolean {
  const set = new Set(paths);
  return (filePath) => set.has(filePath);
}

describe('splitOpenSelection', () => {
  it('只选了文件时按原顺序打开，不换文件夹', () => {
    expect(splitOpenSelection(['/docs/a.md', '  /docs/b.txt  '], dirs('/docs'))).toEqual({
      files: ['/docs/a.md', '/docs/b.txt'],
      directory: null,
    });
  });

  it('只选了文件夹时不打开任何文件', () => {
    expect(splitOpenSelection(['/work/notes'], dirs('/work/notes'))).toEqual({
      files: [],
      directory: '/work/notes',
    });
  });

  it('文件夹和文件一起选时，只留第一个文件夹', () => {
    expect(
      splitOpenSelection(
        ['/docs/a.md', '/work/notes', '/work/other', '/docs/b.md'],
        dirs('/work/notes', '/work/other')
      )
    ).toEqual({
      files: [],
      directory: '/work/notes',
    });
  });

  it('空路径丢掉；判断文件夹失败时仍当文件', () => {
    const boom = (filePath: string): boolean => {
      if (filePath === '/secret') throw new Error('拒绝');
      return filePath === '/work';
    };
    expect(splitOpenSelection(['', '  ', '/secret', '/work'], boom)).toEqual({
      files: [],
      directory: '/work',
    });
    expect(splitOpenSelection(['/secret'], boom)).toEqual({
      files: ['/secret'],
      directory: null,
    });
  });
});

describe('openDialogProperties', () => {
  it('macOS 同一个对话框可以选文件和文件夹', () => {
    expect(openDialogProperties('darwin')).toEqual(['openFile', 'openDirectory', 'multiSelections']);
  });

  it('Windows 和 Linux 仍只选文件，避免对话框变成只能选文件夹', () => {
    expect(openDialogProperties('win32')).toEqual(['openFile', 'multiSelections']);
    expect(openDialogProperties('linux')).toEqual(['openFile', 'multiSelections']);
    expect(openDialogProperties('')).toEqual(['openFile', 'multiSelections']);
  });
});
