import { describe, expect, it } from 'vitest';
import { collectDroppedMarkdownPaths } from './dropFiles';

describe('collectDroppedMarkdownPaths', () => {
  it('只留下带真实路径的 Markdown 文件', () => {
    const paths = collectDroppedMarkdownPaths([
      { path: '/docs/a.md', name: 'a.md' },
      { path: '/docs/readme.txt', name: 'readme.txt' },
      { path: '/docs/b.MARKDOWN', name: 'b.MARKDOWN' },
      { path: '/docs/c.mdx', name: 'c.mdx' },
    ]);
    expect(paths).toEqual(['/docs/a.md', '/docs/b.MARKDOWN', '/docs/c.mdx']);
  });

  it('没有路径的拖放对象（如网页里的占位）直接忽略', () => {
    expect(collectDroppedMarkdownPaths([{ name: 'a.md' }, null, undefined, { path: '   ' }])).toEqual([]);
  });

  it('缺文件名时按路径末段判断类型，并去掉重复路径', () => {
    const paths = collectDroppedMarkdownPaths([
      { path: '/docs/notes/b.md' },
      { path: '/docs/notes/b.md' },
      { path: '/docs/notes/pic.png' },
    ]);
    expect(paths).toEqual(['/docs/notes/b.md']);
  });
});
