import { describe, expect, it } from 'vitest';
import {
  buildImageDiagnostics,
  isLocalImageRef,
  parseMarkdownImageRefs,
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
  });
});

