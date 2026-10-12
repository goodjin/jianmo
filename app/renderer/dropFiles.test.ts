import { describe, expect, it } from 'vitest';
import { collectDroppedDocumentPaths } from './dropFiles';

describe('collectDroppedDocumentPaths', () => {
  it('留下带真实路径的 Markdown / JSON / JSONL，忽略其它类型', () => {
    const paths = collectDroppedDocumentPaths([
      { path: '/docs/a.md', name: 'a.md' },
      { path: '/docs/readme.txt', name: 'readme.txt' },
      { path: '/docs/b.MARKDOWN', name: 'b.MARKDOWN' },
      { path: '/docs/c.mdx', name: 'c.mdx' },
      { path: '/docs/data.json', name: 'data.json' },
      { path: '/docs/rows.JSONL', name: 'rows.JSONL' },
    ]);
    expect(paths).toEqual([
      '/docs/a.md',
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
    ]);
    expect(paths).toEqual(['/docs/notes/b.md', '/docs/notes/data.json']);
  });
});
