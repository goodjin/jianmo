import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  extractMarkdownLinkHrefs,
  pathsEqualFs,
  resolveMarkdownHrefToFsPath,
} from '../markdown/markdownLinkRefs';

describe('extractMarkdownLinkHrefs (M64)', () => {
  it('collects inline links but skips images', () => {
    const md = 'See [a](./a.md) and ![i](./i.png) more [b](b.md).';
    expect(extractMarkdownLinkHrefs(md)).toEqual(['./a.md', 'b.md']);
  });

  it('collects reference-style link urls', () => {
    const md = `# T\n\n[use][ref]\n\n[ref]: ./doc/target.md`;
    expect(extractMarkdownLinkHrefs(md)).toContain('./doc/target.md');
  });

  it('maps Obsidian-style wiki links to .md filenames', () => {
    expect(extractMarkdownLinkHrefs('[[My Page]]')).toEqual(['My Page.md']);
    expect(extractMarkdownLinkHrefs('[[x/y.md]]')).toEqual(['x/y.md']);
    expect(extractMarkdownLinkHrefs('[[Foo|shown]]')).toEqual(['Foo.md']);
  });

  it('captures anchors in markdown links but resolves path without hash', () => {
    expect(extractMarkdownLinkHrefs('[x](./here.md#h)')).toEqual(['./here.md#h']); // extractor keeps fragment; resolver strips
    const root = '/ws';
    const src = path.join('/ws', 'ch', 'here.md');
    expect(
      resolveMarkdownHrefToFsPath({
        sourceFileFsPath: src,
        href: './hub.md#sec',
        workspaceRootFsPath: root,
      })
    ).toBe(path.normalize(path.join('/ws', 'ch', 'hub.md')));
  });
});

describe('resolveMarkdownHrefToFsPath', () => {
  it('resolves slash-prefixed href from workspace root', () => {
    const root = path.normalize('/workspace');
    const src = path.join(root, 'a', 'b.md');
    const out = resolveMarkdownHrefToFsPath({
      sourceFileFsPath: src,
      href: '/notes/target.md',
      workspaceRootFsPath: root,
    });
    expect(out).toBe(path.join(root, 'notes', 'target.md'));
  });

  it('resolves relative paths from source directory', () => {
    const root = path.normalize('/workspace');
    const src = path.join(root, 'a', 'note.md');
    const out = resolveMarkdownHrefToFsPath({
      sourceFileFsPath: src,
      href: '../b/other.md',
      workspaceRootFsPath: root,
    });
    expect(out).toBe(path.normalize(path.join(root, 'b', 'other.md')));
  });
});

describe('pathsEqualFs', () => {
  it('treats equivalent paths as equal on POSIX', () => {
    const a = path.normalize('/tmp/x/a.md');
    const b = path.normalize('/tmp/x/../x/a.md');
    expect(pathsEqualFs(a, b)).toBe(true);
  });
});
