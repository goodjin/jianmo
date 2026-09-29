import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FILE_TREE_ERR_NO_ROOT,
  FILE_TREE_ERR_OUTSIDE,
  FILE_TREE_ERR_UNREADABLE,
  listFileTree,
} from './fileTree';

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-file-tree-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('listFileTree', () => {
  it('文件夹在前，只含 Markdown，跳过隐藏项、node_modules 和非 md', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'b-dir'));
    fs.mkdirSync(path.join(root, 'a-dir'));
    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'node_modules', 'secret.md'), '# s');
    fs.writeFileSync(path.join(root, '.hidden.md'), '# h');
    fs.writeFileSync(path.join(root, 'item10.md'), '# 10');
    fs.writeFileSync(path.join(root, 'item2.md'), '# 2');
    fs.writeFileSync(path.join(root, 'notes.mdx'), '# x');
    fs.writeFileSync(path.join(root, 'skip.txt'), 'no');
    fs.writeFileSync(path.join(root, 'a-dir', 'inner.md'), '# in');

    const page = listFileTree(root, root);
    expect(page.error).toBe('');
    expect(page.entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
      'dir:a-dir',
      'dir:b-dir',
      'file:item2.md',
      'file:item10.md',
      'file:notes.mdx',
    ]);
    expect(page.entries.find((e) => e.name === 'a-dir')?.path).toBe(path.join(root, 'a-dir'));

    const inner = listFileTree(path.join(root, 'a-dir'), root);
    expect(inner.entries.map((e) => e.name)).toEqual(['inner.md']);
  });

  it('未选根、越界、不存在、把文件当目录，都返回错误且不抛', () => {
    const root = tmpDir();
    const outside = tmpDir();
    const file = path.join(root, 'a.md');
    fs.writeFileSync(file, '# a');
    fs.writeFileSync(path.join(outside, 'secret.md'), '# s');

    expect(listFileTree(root, '  ').error).toBe(FILE_TREE_ERR_NO_ROOT);
    expect(listFileTree(outside, root).error).toBe(FILE_TREE_ERR_OUTSIDE);
    expect(listFileTree(outside, root).entries).toEqual([]);
    expect(listFileTree(path.join(root, 'missing'), root).error).toBe(FILE_TREE_ERR_UNREADABLE);
    expect(listFileTree(file, root).error).toBe(FILE_TREE_ERR_UNREADABLE);

    const escaped = path.resolve(root, '..');
    expect(listFileTree(escaped, root).error).toBe(FILE_TREE_ERR_OUTSIDE);
  });

  it('符号链接即使指向根外也不出现在树里', () => {
    const root = tmpDir();
    const outside = tmpDir();
    fs.writeFileSync(path.join(outside, 'secret.md'), '# s');
    fs.writeFileSync(path.join(root, 'keep.md'), '# k');
    fs.symlinkSync(outside, path.join(root, 'linked'), 'dir');
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'linked.md'));

    const page = listFileTree(root, root);
    expect(page.entries.map((e) => e.name)).toEqual(['keep.md']);
    expect(listFileTree(path.join(root, 'linked'), root).error).toBe(FILE_TREE_ERR_OUTSIDE);
  });
});
