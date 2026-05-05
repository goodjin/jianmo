import { describe, expect, it } from 'vitest';
import { buildExportFailureDiagnosticsMarkdown, redactSensitivePaths } from '../exportDiagnostics';

describe('exportDiagnostics', () => {
  it('redacts unix home-style paths', () => {
    const s = redactSensitivePaths('failed at /Users/secret/project/file.md');
    expect(s).not.toContain('/Users/secret');
    expect(s).toContain('<redacted-path>');
  });

  it('redacts windows drive paths', () => {
    const s = redactSensitivePaths('err C:\\Users\\x\\out.pdf');
    expect(s).not.toContain('C:\\Users');
    expect(s).toContain('<redacted-path>');
  });

  it('does not leak raw path in error message inside markdown package', () => {
    const md = buildExportFailureDiagnosticsMarkdown({
      format: 'pdf',
      error: new Error('write failed: /Users/me/secret/out.pdf'),
      documentBasename: 'note.md',
      outputBasename: 'out.pdf',
      vscodeVersion: '1.99.0',
      extensionVersion: '1.0.0',
      platform: 'darwin',
      arch: 'arm64',
    });
    expect(md).not.toContain('/Users/me/');
    expect(md).toContain('<redacted-path>');
    expect(md).toContain('"format": "pdf"');
    expect(md).toContain('note.md');
  });
});
