import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  analyzeMarkdownExportPreflight,
  detectBrokenMathDelimiters,
  stripFencedCodeAndHtmlCommentsForMathScan,
  extractHttpsMarkdownImageHosts,
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
    const miss = issues.find((i) => i.kind === 'missing_image' && i.ref === './a.png');
    expect(miss).toBeTruthy();
    expect(miss?.sourceLine).toBe(1);
  });

  it('M224: attaches sourceLine for broken math outside fences', () => {
    const md = '# t\n\nok\n\ninline $broken\n';
    const issues = analyzeMarkdownExportPreflight({
      markdown: md,
      sourceFileFsPath: '/tmp/x.md',
      workspaceRootFsPath: '/tmp',
      scope: 'full',
      existsSync: () => true,
    });
    const math = issues.find((i) => i.kind === 'broken_math');
    expect(math).toBeTruthy();
    expect(math?.sourceLine).toBe(5);
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

  it('M46: non-empty host allowlist flags remote https images outside list', () => {
    const issues = analyzeMarkdownExportPreflight({
      markdown: '![](https://evil.test/a.png)',
      sourceFileFsPath: '/tmp/x.md',
      workspaceRootFsPath: '/tmp',
      scope: 'images',
      remoteHttpsHostsAllowlist: ['allowed.example'],
      existsSync: () => true,
    });
    expect(issues.some((i) => i.kind === 'remote_image_host' && (i.ref ?? '').includes('evil.test'))).toBe(true);
  });

  it('M46: allowlist accepts host case-insensitive and ignores leading www.', () => {
    const issues = analyzeMarkdownExportPreflight({
      markdown: '![](https://WWW.AllowED.example/x.png)',
      sourceFileFsPath: '/tmp/x.md',
      workspaceRootFsPath: '/tmp',
      scope: 'images',
      remoteHttpsHostsAllowlist: ['allowed.example'],
      existsSync: () => true,
    });
    expect(issues.filter((i) => i.kind === 'remote_image_host')).toHaveLength(0);
  });

  it('M133: allowlist supports "*.example" to allow subdomains', () => {
    const issues = analyzeMarkdownExportPreflight({
      markdown: '![](https://a.allowed.example/x.png)\n![](https://allowed.example/y.png)\n![](https://evil.test/z.png)',
      sourceFileFsPath: '/tmp/x.md',
      workspaceRootFsPath: '/tmp',
      scope: 'images',
      remoteHttpsHostsAllowlist: ['*.allowed.example'],
      existsSync: () => true,
    });
    expect(issues.some((i) => i.kind === 'remote_image_host' && (i.ref ?? '').includes('evil.test'))).toBe(true);
    expect(issues.some((i) => i.kind === 'remote_image_host' && (i.ref ?? '').includes('a.allowed.example'))).toBe(false);
    expect(issues.some((i) => i.kind === 'remote_image_host' && (i.ref ?? '').includes('allowed.example/y.png'))).toBe(false);
  });
});

describe('extractHttpsMarkdownImageHosts', () => {
  it('collects src rows and normalizes host casing', () => {
    const rows = extractHttpsMarkdownImageHosts('![](https://A.EXAMPLE/x.png)\n![](https://b.test/y.png)');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.host).sort()).toEqual(['a.example', 'b.test']);
  });
});
