import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
  const normalizePath = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const parts: string[] = [];
    for (const part of normalized.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return `${normalized.startsWith('/') ? '/' : ''}${parts.join('/')}`;
  };
  class Uri {
    fsPath: string;
    constructor(filePath: string) {
      this.fsPath = normalizePath(filePath);
    }
    static file(filePath: string) {
      return new Uri(filePath);
    }
  }
  return { Uri };
});

import * as vscode from 'vscode';
import { buildRenameImageRefReplacements } from '../image/renameImageRefs';

describe('M51 buildRenameImageRefReplacements', () => {
  it('builds relative replacements for image rename', () => {
    const doc = vscode.Uri.file('/repo/docs/a.md');
    const oldUri = vscode.Uri.file('/repo/docs/assets/a b.png');
    const newUri = vscode.Uri.file('/repo/docs/assets/a-b.png');

    const reps = buildRenameImageRefReplacements(doc, [{ oldUri, newUri }]);
    const pairs = reps.map((x) => `${x.from}=>${x.to}`);

    expect(pairs).toContain('assets/a b.png=>assets/a-b.png');
    expect(pairs).toContain('./assets/a b.png=>./assets/a-b.png');
    expect(pairs).toContain('assets/a%20b.png=>assets/a-b.png');
    expect(pairs).toContain('./assets/a%20b.png=>./assets/a-b.png');
  });

  it('ignores non-image files', () => {
    const doc = vscode.Uri.file('/repo/docs/a.md');
    const oldUri = vscode.Uri.file('/repo/docs/assets/a.txt');
    const newUri = vscode.Uri.file('/repo/docs/assets/b.txt');

    expect(buildRenameImageRefReplacements(doc, [{ oldUri, newUri }])).toEqual([]);
  });
});

