import { describe, expect, it } from 'vitest';
import { PREVIEW_DROP, previewDropRuntimeSource, readPreviewDropFiles } from './previewDrop';

describe('readPreviewDropFiles', () => {
  it('只认预览拖放消息，留下带路径的文件', () => {
    expect(readPreviewDropFiles(null)).toBeNull();
    expect(readPreviewDropFiles({ type: 'OTHER', files: [] })).toBeNull();
    expect(
      readPreviewDropFiles({
        type: PREVIEW_DROP,
        files: [
          { path: '/docs/a.txt', name: 'a.txt' },
          { path: '', name: '空' },
          { name: '只有名字' },
          null,
        ],
      })
    ).toEqual([
      { path: '/docs/a.txt', name: 'a.txt' },
      { path: '', name: '空' },
      { path: '', name: '只有名字' },
    ]);
  });
});

describe('previewDropRuntimeSource', () => {
  it('接住拖放并把路径交给父页面', () => {
    const source = previewDropRuntimeSource();
    expect(source).toContain(PREVIEW_DROP);
    expect(source).toContain('parent.postMessage');
    expect(source).toContain('dragover');
    expect(source).toContain('__marklyPreviewDrop');
  });
});
