import { describe, expect, it } from 'vitest';
import { displayDirFromPath, displayNameFromPath } from './documentMeta';

describe('displayNameFromPath', () => {
  it('posix 路径取最后一段为文件名，完整路径原样保留', () => {
    expect(displayNameFromPath('/Users/me/notes/hello.md')).toEqual({
      filePath: '/Users/me/notes/hello.md',
      fileName: 'hello.md',
    });
  });

  it('Windows 路径按反斜杠分段', () => {
    expect(displayNameFromPath('C:\\Users\\me\\notes\\hello.md')).toEqual({
      filePath: 'C:\\Users\\me\\notes\\hello.md',
      fileName: 'hello.md',
    });
  });

  it('空字符串 / 空白 / null / undefined → 文件名与路径都为空', () => {
    expect(displayNameFromPath('')).toEqual({ filePath: '', fileName: '' });
    expect(displayNameFromPath('   ')).toEqual({ filePath: '', fileName: '' });
    expect(displayNameFromPath(null)).toEqual({ filePath: '', fileName: '' });
    expect(displayNameFromPath(undefined)).toEqual({ filePath: '', fileName: '' });
  });

  it('仅文件名（无目录）原样作为文件名', () => {
    expect(displayNameFromPath('readme.md')).toEqual({
      filePath: 'readme.md',
      fileName: 'readme.md',
    });
  });
});

describe('displayDirFromPath', () => {
  it('posix 去掉末段文件名，不带结尾斜杠', () => {
    expect(displayDirFromPath('/Users/me/notes/hello.md')).toBe('/Users/me/notes');
  });

  it('Windows 路径去掉文件名', () => {
    expect(displayDirFromPath('C:\\Users\\me\\notes\\hello.md')).toBe('C:\\Users\\me\\notes');
  });

  it('无目录或空路径 → 空串', () => {
    expect(displayDirFromPath('readme.md')).toBe('');
    expect(displayDirFromPath('')).toBe('');
    expect(displayDirFromPath(null)).toBe('');
  });
});
