import { describe, expect, it } from 'vitest';
import {
  buildImageDiagnostics,
  computeUnreferencedAssetImages,
  formatMissingImageRefsList,
  formatUnreferencedAssetImagesList,
  isLocalImageRef,
  normalizeLocalImageRefsToDirectory,
  parseMarkdownImageRefs,
  replaceMarkdownImageRef,
} from '../imageDiagnostics';

describe('imageDiagnostics', () => {
  it('classifies local, remote, file and data image refs', () => {
    expect(isLocalImageRef('./assets/a.png')).toBe(true);
    expect(isLocalImageRef('../img/a.png')).toBe(true);
    expect(isLocalImageRef('https://example.com/a.png')).toBe(false);
    expect(isLocalImageRef('data:image/png;base64,aaa')).toBe(false);
    expect(isLocalImageRef('file:///tmp/a.png')).toBe(false);
    expect(isLocalImageRef('/absolute/a.png')).toBe(false);
  });

  it('parses markdown image references with alt text and title suffixes', () => {
    const refs = parseMarkdownImageRefs('![Local](./a.png "title") and ![Remote](https://e.test/b.png)');

    expect(refs).toEqual([
      { alt: 'Local', src: './a.png', isLocal: true },
      { alt: 'Remote', src: 'https://e.test/b.png', isLocal: false },
    ]);
  });

  it('builds concrete diagnostics including local samples and compression policy', () => {
    const diagnostics = buildImageDiagnostics({
      markdown: '![a](assets/a.png)\n![b](https://e.test/b.png)\n![c](assets/c.png)',
      renderedImages: ['assets/a.png'],
      saveDirectory: './assets',
      compressThreshold: 1024,
      compressQuality: 0.82,
      localCheckResults: [
        { ref: 'assets/a.png', exists: true, resolvedPath: '/repo/assets/a.png' },
        { ref: 'assets/c.png', exists: false, resolvedPath: '/repo/assets/c.png', error: 'not found' },
      ],
      lastCheckedAt: '2026-04-29T00:00:00.000Z',
    });

    expect(diagnostics.totalRefs).toBe(3);
    expect(diagnostics.localRefs).toBe(2);
    expect(diagnostics.remoteRefs).toBe(1);
    expect(diagnostics.renderedImages).toBe(1);
    expect(diagnostics.localRefSamples).toEqual(['assets/a.png', 'assets/c.png']);
    expect(diagnostics.checkedLocalRefs).toBe(2);
    expect(diagnostics.existingRefs).toEqual([{ ref: 'assets/a.png', resolvedPath: '/repo/assets/a.png' }]);
    expect(diagnostics.missingRefs).toEqual([{ ref: 'assets/c.png', resolvedPath: '/repo/assets/c.png', error: 'not found' }]);
    expect(diagnostics.lastCheckedAt).toBe('2026-04-29T00:00:00.000Z');
    expect(diagnostics.compression).toEqual({ threshold: 1024, quality: 0.82 });
    expect(diagnostics.assetDirectoryListedCount).toBe(null);
    expect(diagnostics.unreferencedAssetRelativePaths).toBe(null);
  });

  it('M55 adds unreferenced listing when asset paths are scanned', () => {
    const diagnostics = buildImageDiagnostics({
      markdown: '![x](./assets/used.png)\n[同上](./assets/link.png)',
      renderedImages: [],
      saveDirectory: './assets',
      localCheckResults: [],
      assetRelativeDirectoryImagePaths: ['./assets/link.png', './assets/orphan.png', './assets/used.png'],
    });

    expect(diagnostics.assetDirectoryListedCount).toBe(3);
    expect(diagnostics.unreferencedAssetRelativePaths).toEqual(['./assets/orphan.png']);
  });

  it('computeUnreferencedAssetImages counts markdown links and reference definitions', () => {
    const md = `
![via image](./assets/by-img.png)
[via link](./assets/by-link.png)
[ref-def]: ./assets/by-def.png`;
    const assets = ['./assets/by-img.png', './assets/by-link.png', './assets/by-def.png', './assets/no.png'];
    expect(computeUnreferencedAssetImages(md, assets)).toEqual(['./assets/no.png']);
  });

  it('formats unreferenced asset paths as bullet list copy text', () => {
    expect(formatUnreferencedAssetImagesList(['./assets/a.png'])).toContain('- ./assets/a.png');
    expect(formatUnreferencedAssetImagesList([])).toContain('未发现未引用');
  });

  it('formats missing image refs as a copyable markdown table', () => {
    const text = formatMissingImageRefsList([
      { ref: './a|b.png', resolvedPath: '/repo/a|b.png', error: 'not found' },
    ]);

    expect(text).toContain('缺失图片引用清单');
    expect(text).toContain('./a\\|b.png');
    expect(text).toContain('/repo/a\\|b.png');
    expect(text).toContain('not found');
  });

  it('replaces only matching markdown image refs and preserves titles', () => {
    const next = replaceMarkdownImageRef(
      '![a](old.png "title") ![b](other.png) [old.png](old.png)',
      'old.png',
      './assets/new.png'
    );

    expect(next).toBe('![a](./assets/new.png "title") ![b](other.png) [old.png](old.png)');
  });

  it('normalizes local image refs to the configured save directory', () => {
    const next = normalizeLocalImageRefsToDirectory(
      '![a](../img/a.png) ![b](https://e.test/b.png) ![c](/abs/c.png) ![d](old/d.png "t")',
      './assets'
    );

    expect(next).toBe('![a](./assets/a.png) ![b](https://e.test/b.png) ![c](/abs/c.png) ![d](./assets/d.png "t")');
  });
});

