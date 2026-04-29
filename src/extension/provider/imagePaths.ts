import * as vscode from 'vscode';

export function isLocalMarkdownImageRef(src: string): boolean {
  const value = String(src ?? '').trim();
  return !!value && !/^(https?:|data:|file:)/i.test(value) && !value.startsWith('/');
}

export function normalizeMarkdownImagePath(src: string): string {
  return String(src ?? '').trim().split(/[?#]/)[0] ?? '';
}

export function resolveMarkdownImageUri(documentUri: vscode.Uri, src: string): vscode.Uri | null {
  if (!isLocalMarkdownImageRef(src)) return null;
  const clean = normalizeMarkdownImagePath(src);
  if (!clean) return null;
  const docDir = vscode.Uri.joinPath(documentUri, '..');
  const parts = clean.split('/').filter((part) => part && part !== '.');
  return vscode.Uri.joinPath(docDir, ...parts);
}

