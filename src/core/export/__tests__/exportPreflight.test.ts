import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzeMarkdownExportPreflight,
  detectBrokenMathDelimiters,
  stripFencedCodeAndHtmlCommentsForMathScan,
} from '../exportPreflight';

describe('detectBrokenMathDelimiters', () => {
  it('returns undefined when delimiters look balanced', () => {
    expect(detectBrokenMathDelimiters('inline $a$ and $$b$$')).toBeUndefined();
  });

  it('flags odd $$ count', () => {
    expect(detectBrokenMathDelimiters('$$x')).toContain('$$');
  });

  it('ignores math-like markers inside fenced code', () => {
    const md = '```\n$broken\n$$\n```\n\n$ok$';
    expect(detectBrokenMathDelimiters(md)).toBeUndefined();
  });

  it('flags unpaired single dollar after stripping fences', () => {
    expect(detectBrokenMathDelimiters('price is $5')).toContain('$');
  });
});

describe('stripFencedCodeAndHtmlCommentsForMathScan', () => {
  it('removes html comments', () => {
    const s = stripFencedCodeAndHtmlCommentsForMathScan('a <!-- $broken --> b');
    expect(s).not.toContain('$broken');
  });
});

describe('analyzeMarkdownExportPreflight', () => {
  it('returns empty when scope is off', () => {
    expect(
      analyzeMarkdownExportPreflight({
        markdown: '![](nope.png)',
        sourceFileFsPath: '/tmp/x.md',
        workspaceRootFsPath: '/tmp',
        scope: 'off',
        existsSync: () => false,
      })
    ).toHaveLength(0);
  });

  it('reports missing image under images scope', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-pf-'));
    const mdPath = path.join(root, 'doc.md');
    fs.writeFileSync(mdPath, '![](./a.png)\n');
    const issues = analyzeMarkdownExportPreflight({
      markdown: fs.readFileSync(mdPath, 'utf-8'),
      sourceFileFsPath: mdPath,
      workspaceRootFsPath: root,
      scope: 'images',
    });
    expect(issues.some((i) => i.kind === 'missing_image' && i.ref === './a.png')).toBe(true);
  });

  it('reports missing local link under full scope', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-pf2-'));
    const mdPath = path.join(root, 'doc.md');
    fs.writeFileSync(mdPath, '[t](./missing.md)\n');
    const issues = analyzeMarkdownExportPreflight({
      markdown: fs.readFileSync(mdPath, 'utf-8'),
      sourceFileFsPath: mdPath,
      workspaceRootFsPath: root,
      scope: 'full',
    });
    expect(issues.some((i) => i.kind === 'missing_local_link' && i.ref === './missing.md')).toBe(true);
  });

  it('does not report link when target exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-pf3-'));
    const mdPath = path.join(root, 'doc.md');
    fs.writeFileSync(path.join(root, 'other.md'), '# x\n');
    fs.writeFileSync(mdPath, '[t](./other.md)\n');
    const issues = analyzeMarkdownExportPreflight({
      markdown: fs.readFileSync(mdPath, 'utf-8'),
      sourceFileFsPath: mdPath,
      workspaceRootFsPath: root,
      scope: 'full',
    });
    expect(issues.filter((i) => i.kind === 'missing_local_link')).toHaveLength(0);
  });

  it('skips missing link check when scope is images', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-pf4-'));
    const mdPath = path.join(root, 'doc.md');
    fs.writeFileSync(mdPath, '[t](./missing.md)\n');
    const issues = analyzeMarkdownExportPreflight({
      markdown: fs.readFileSync(mdPath, 'utf-8'),
      sourceFileFsPath: mdPath,
      workspaceRootFsPath: root,
      scope: 'images',
    });
    expect(issues).toHaveLength(0);
  });
});
