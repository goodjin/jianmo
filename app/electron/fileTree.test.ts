import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FILE_TREE_ERR_NO_ROOT,
  FILE_TREE_ERR_OUTSIDE,
  FILE_TREE_ERR_UNREADABLE,
  listFileTree,
  shouldListTreeName,
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

describe('shouldListTreeName', () => {
  it('默认跳过点开头的名字，打开后才列出来', () => {
    expect(shouldListTreeName('.git', false)).toBe(false);
    expect(shouldListTreeName('.gitignore', false)).toBe(false);
    expect(shouldListTreeName('.git', true)).toBe(true);
    expect(shouldListTreeName('.gitignore', true)).toBe(true);
    expect(shouldListTreeName('docs', false)).toBe(true);
    expect(shouldListTreeName('docs', true)).toBe(true);
  });

  it('点自己、上一级和 node_modules 始终不列', () => {
    expect(shouldListTreeName('', true)).toBe(false);
    expect(shouldListTreeName('.', true)).toBe(false);
    expect(shouldListTreeName('..', true)).toBe(false);
    expect(shouldListTreeName('node_modules', true)).toBe(false);
    expect(shouldListTreeName('Node_Modules', false)).toBe(false);
  });
});

describe('listFileTree', () => {
  it('文件夹在前，含文本文件，跳过隐藏项、node_modules 和图片', () => {
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
    fs.writeFileSync(path.join(root, 'data.json'), '{}');
    fs.writeFileSync(path.join(root, 'rows.JSONL'), '{}\n');
    fs.writeFileSync(path.join(root, 'skip.png'), 'no');
    fs.writeFileSync(path.join(root, 'readme.txt'), 'hi');
    fs.writeFileSync(path.join(root, 'id.pub'), 'ssh-ed25519 AAAA');
    fs.writeFileSync(path.join(root, 'a-dir', 'inner.md'), '# in');

    const page = listFileTree(root, root);
    expect(page.error).toBe('');
    expect(page.entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
      'dir:a-dir',
      'dir:b-dir',
      'file:data.json',
      'file:id.pub',
      'file:item2.md',
      'file:item10.md',
      'file:notes.mdx',
      'file:readme.txt',
      'file:rows.JSONL',
    ]);
    expect(page.entries.find((e) => e.name === 'a-dir')?.path).toBe(path.join(root, 'a-dir'));

    const inner = listFileTree(path.join(root, 'a-dir'), root);
    expect(inner.entries.map((e) => e.name)).toEqual(['inner.md']);

    const shown = listFileTree(root, root, true);
    const names = shown.entries.map((e) => e.name);
    expect(names).toContain('.git');
    expect(names).toContain('.hidden.md');
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('skip.png');
    expect(shown.entries.find((e) => e.name === '.git')?.kind).toBe('dir');
    expect(shown.entries.find((e) => e.name === '.hidden.md')?.kind).toBe('file');
    const lastDir = shown.entries.reduce((acc, entry, index) => (entry.kind === 'dir' ? index : acc), -1);
    const firstFile = shown.entries.findIndex((entry) => entry.kind === 'file');
    expect(lastDir).toBeLessThan(firstFile);
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
