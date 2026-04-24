import { describe, expect, it } from 'vitest';
import { buildDiagnosticsPackageText, redactDiagnosticsJson } from '../diagnosticsPackage';

describe('diagnosticsPackage', () => {
  it('redacts absolute paths in strings', () => {
    const obj = redactDiagnosticsJson({
      a: '/Users/jin/secret/project/file.md',
      b: '/home/alice/.ssh/id_rsa',
      c: 'C:\\Users\\Bob\\Desktop\\x.txt',
      d: '\\\\server\\share\\x',
    });
    const s = JSON.stringify(obj);
    expect(s).not.toContain('/Users/jin/');
    expect(s).not.toContain('/home/alice/');
    expect(s).not.toContain('C:\\Users\\Bob\\');
    expect(s).not.toContain('\\\\server\\share\\');
    expect(s).toContain('<redacted-path>');
  });

  it('limits output length and reports truncation', () => {
    const base = {
      consoleRecent: Array.from({ length: 200 }, (_, i) => ({
        level: 'error',
        text: `/Users/jin/secret/${i} ` + 'x'.repeat(200),
      })),
    };
    const { text, truncated } = buildDiagnosticsPackageText({ base, maxChars: 2048 });
    expect(text.length).toBeLessThanOrEqual(2048);
    expect(truncated).toBe(true);
    expect(text).not.toContain('/Users/jin/');
  });
});

