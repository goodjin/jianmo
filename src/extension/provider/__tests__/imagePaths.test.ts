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
    path: string;

    constructor(filePath: string) {
      this.fsPath = normalizePath(filePath);
      this.path = this.fsPath.replace(/\\/g, '/');
    }

    static file(filePath: string) {
      return new Uri(filePath);
    }

    static joinPath(base: Uri, ...parts: string[]) {
      return new Uri([base.fsPath, ...parts].join('/'));
    }
  }

  return { Uri };
});

import { isLocalMarkdownImageRef, normalizeMarkdownImagePath, resolveMarkdownImageUri } from '../imagePaths';
import * as vscode from 'vscode';

describe('image path resolution', () => {
  it('classifies local markdown image refs', () => {
    expect(isLocalMarkdownImageRef('./assets/a.png')).toBe(true);
    expect(isLocalMarkdownImageRef('../assets/a.png')).toBe(true);
    expect(isLocalMarkdownImageRef('https://example.com/a.png')).toBe(false);
    expect(isLocalMarkdownImageRef('data:image/png;base64,abc')).toBe(false);
    expect(isLocalMarkdownImageRef('/absolute/a.png')).toBe(false);
  });

  it('strips query and hash suffixes before filesystem resolution', () => {
    expect(normalizeMarkdownImagePath('./assets/a.png?raw=1#v2')).toBe('./assets/a.png');
  });

  it('resolves dot and parent-relative refs from the current document directory', () => {
    const docUri = vscode.Uri.file('/repo/docs/guide/intro.md');

    expect(resolveMarkdownImageUri(docUri, './assets/a.png')?.fsPath).toBe('/repo/docs/guide/assets/a.png');
    expect(resolveMarkdownImageUri(docUri, '../assets/a.png')?.fsPath).toBe('/repo/docs/assets/a.png');
    expect(resolveMarkdownImageUri(docUri, 'assets/a.png?raw=1')?.fsPath).toBe('/repo/docs/guide/assets/a.png');
  });

  it('returns null for remote or empty refs', () => {
    const docUri = vscode.Uri.file('/repo/docs/guide/intro.md');

    expect(resolveMarkdownImageUri(docUri, '')).toBeNull();
    expect(resolveMarkdownImageUri(docUri, 'https://example.com/a.png')).toBeNull();
  });
});

