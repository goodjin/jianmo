import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { listMarkdownFilesPage } from './dirMarkdown';

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-dir-md-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('listMarkdownFilesPage', () => {
  it('只列出当前层 md 文件，按名字排序，不含子目录与非 md', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'b.md'), '# b');
    fs.writeFileSync(path.join(dir, 'a.md'), '# a');
    fs.writeFileSync(path.join(dir, 'c.mdx'), '# c');
    fs.writeFileSync(path.join(dir, 'skip.txt'), 'no');
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'nested', 'inner.md'), '# inner');
    const page = listMarkdownFilesPage(dir, 0, 100);
    expect(page.files.map((f) => f.name)).toEqual(['a.md', 'b.md', 'c.mdx']);
    expect(page.hasMore).toBe(false);
    expect(page.files[0]?.path).toBe(path.join(dir, 'a.md'));
  });

  it('分页：第一页 100、更多按钮对应 nextOffset 下一批', () => {
    const dir = tmpDir();
    for (let i = 0; i < 130; i++) {
      fs.writeFileSync(path.join(dir, `n${String(i).padStart(3, '0')}.md`), `# ${i}`);
    }
    const p1 = listMarkdownFilesPage(dir, 0, 100);
    expect(p1.files).toHaveLength(100);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextOffset).toBe(100);
    const p2 = listMarkdownFilesPage(dir, p1.nextOffset, 100);
    expect(p2.files).toHaveLength(30);
    expect(p2.hasMore).toBe(false);
    expect(p1.files[0]?.name).not.toBe(p2.files[0]?.name);
  });

  it('目录不存在或空路径 → 空列表不抛', () => {
    expect(listMarkdownFilesPage('/no/such/markly-dir-xyz', 0).files).toEqual([]);
    expect(listMarkdownFilesPage('  ', 0).dir).toBe('');
  });
});
