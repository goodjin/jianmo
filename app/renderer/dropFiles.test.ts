import { describe, expect, it } from 'vitest';
import { collectDroppedDocumentPaths } from './dropFiles';

describe('collectDroppedDocumentPaths', () => {
  it('留下文本路径，图片和压缩包按扩展名略过', () => {
    const paths = collectDroppedDocumentPaths([
      { path: '/docs/a.md', name: 'a.md' },
      { path: '/docs/readme.txt', name: 'readme.txt' },
      { path: '/docs/id_ed25519.pub', name: 'id_ed25519.pub' },
      { path: '/docs/b.MARKDOWN', name: 'b.MARKDOWN' },
      { path: '/docs/c.mdx', name: 'c.mdx' },
      { path: '/docs/data.json', name: 'data.json' },
      { path: '/docs/rows.JSONL', name: 'rows.JSONL' },
      { path: '/docs/pic.png', name: 'pic.png' },
      { path: '/docs/pack.zip', name: 'pack.zip' },
    ]);
    expect(paths).toEqual([
      '/docs/a.md',
      '/docs/readme.txt',
      '/docs/id_ed25519.pub',
      '/docs/b.MARKDOWN',
      '/docs/c.mdx',
      '/docs/data.json',
      '/docs/rows.JSONL',
    ]);
  });

  it('没有路径的拖放对象（如网页里的占位）直接忽略', () => {
    expect(collectDroppedDocumentPaths([{ name: 'a.md' }, null, undefined, { path: '   ' }])).toEqual([]);
  });

  it('缺文件名时按路径末段判断类型，并去掉重复路径', () => {
    const paths = collectDroppedDocumentPaths([
      { path: '/docs/notes/b.md' },
      { path: '/docs/notes/b.md' },
      { path: '/docs/notes/pic.png' },
      { path: '/docs/notes/data.json' },
      { path: '/docs/notes/Makefile' },
    ]);
    expect(paths).toEqual(['/docs/notes/b.md', '/docs/notes/data.json', '/docs/notes/Makefile']);
  });
});
