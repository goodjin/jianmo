import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FILE_TREE_ERR_UNREADABLE } from './fileTreeModel';
import { folderListError, macProtectedFolderLabel, readFailureDetail } from './macFolderAccess';

describe('macProtectedFolderLabel', () => {
  it('认出用户主目录下的文稿、桌面、下载', () => {
    expect(macProtectedFolderLabel('/Users/me/Documents')).toBe('文稿');
    expect(macProtectedFolderLabel('/Users/me/Documents/笔记.md')).toBe('文稿');
    expect(macProtectedFolderLabel('/Users/me/Desktop')).toBe('桌面');
    expect(macProtectedFolderLabel('/Users/me/Downloads/a.md')).toBe('下载');
    expect(macProtectedFolderLabel('C:\\Users\\me\\Documents\\a.md')).toBe('文稿');
  });

  it('项目里碰巧叫 Documents 的目录不算受保护文件夹', () => {
    expect(macProtectedFolderLabel('/work/Documents/a.md')).toBeNull();
    expect(macProtectedFolderLabel('/Users/me/projects/readme.md')).toBeNull();
    expect(macProtectedFolderLabel('/Users/me/Documents-old/a.md')).toBeNull();
    expect(macProtectedFolderLabel('/Documents/a.md')).toBeNull();
  });
});

describe('readFailureDetail', () => {
  it('系统拒绝读取文稿时，说明要到隐私设置里允许', () => {
    const detail = readFailureDetail('/Users/me/Documents/笔记.md', { code: 'EPERM', message: 'operation not permitted' });
    expect(detail).toContain('文稿');
    expect(detail).toContain('文件和文件夹');
  });

  it('桌面被拒绝时点明是桌面', () => {
    expect(readFailureDetail('/Users/me/Desktop/a.md', { code: 'EACCES' })).toContain('桌面');
  });

  it('文件不存在时不说成隐私权限问题', () => {
    const detail = readFailureDetail('/Users/me/Documents/missing.md', { code: 'ENOENT', message: 'no such file' });
    expect(detail).toBe('no such file');
    expect(detail).not.toContain('文件和文件夹');
  });

  it('其它目录没有权限时保留系统原文', () => {
    expect(readFailureDetail('/tmp/secret.md', { code: 'EPERM', message: 'operation not permitted' })).toBe(
      'operation not permitted'
    );
  });
});

describe('folderListError', () => {
  it('受保护目录被拒绝时给出设置说明，普通读失败仍是读不了', () => {
    expect(folderListError('/Users/me/Documents', { code: 'EPERM' })).toContain('文稿');
    expect(folderListError('/Users/me/Documents', { code: 'ENOENT' })).toBe(FILE_TREE_ERR_UNREADABLE);
    expect(folderListError('/tmp/locked', { code: 'EACCES' })).toBe(FILE_TREE_ERR_UNREADABLE);
  });
});

describe('桌面版安装说明', () => {
  it('声明文稿、桌面、下载的用途，避免 macOS 直接退出', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      name: string;
      build: { mac: { extendInfo: Record<string, string> } };
    };
    expect(pkg.name).toBe('markly-app');
    const info = pkg.build.mac.extendInfo;
    expect(info.NSDocumentsFolderUsageDescription).toContain('文稿');
    expect(info.NSDesktopFolderUsageDescription).toContain('桌面');
    expect(info.NSDownloadsFolderUsageDescription).toContain('下载');
  });
});
