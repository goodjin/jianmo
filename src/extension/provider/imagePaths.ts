import * as vscode from 'vscode';
import * as path from 'path';
import { isLocalMarkdownImageRef, resolveMarkdownImageFsPath } from '@core/markdown/markdownImageRefs';

export { isLocalMarkdownImageRef };

export function normalizeMarkdownImagePath(src: string): string {
  return String(src ?? '').trim().split(/[?#]/)[0] ?? '';
}

export function resolveMarkdownImageUri(documentUri: vscode.Uri, src: string): vscode.Uri | null {
  const fsPath = resolveMarkdownImageFsPath(documentUri.fsPath, src);
  if (!fsPath) return null;
  return vscode.Uri.file(fsPath);
}

export function toMarkdownImageRelativePath(documentUri: vscode.Uri, imageUri: vscode.Uri): string {
  const rel = path.relative(path.dirname(documentUri.fsPath), imageUri.fsPath).replace(/\\/g, '/');
  return rel || path.basename(imageUri.fsPath);
}

export { extractMarkdownLocalImageRefs } from '@core/markdown/markdownImageRefs';

export async function checkLocalMarkdownImageRefs(
  documentUri: vscode.Uri,
  refs: string[],
  stat: (uri: vscode.Uri) => Promise<unknown> = (uri) => vscode.workspace.fs.stat(uri)
) {
  const uniqueRefs = Array.from(new Set(refs));
  const results = [];

  for (const ref of uniqueRefs) {
    const imageUri = resolveMarkdownImageUri(documentUri, ref);
    if (!imageUri) continue;
    try {
      await stat(imageUri);
      results.push({ ref, exists: true, resolvedPath: imageUri.fsPath });
    } catch (err) {
      results.push({
        ref,
        exists: false,
        resolvedPath: imageUri.fsPath,
        error: String((err as Error)?.message ?? err ?? 'Image not found'),
      });
    }
  }

  return results;
}

