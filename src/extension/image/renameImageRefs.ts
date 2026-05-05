import * as vscode from 'vscode';
import { toMarkdownImageRelativePath } from '../provider/imagePaths';

export type ImageRefReplacement = { from: string; to: string };

const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.tiff',
  '.tif',
  '.avif',
]);

function isLikelyImageFile(uri: vscode.Uri): boolean {
  const p = uri.fsPath.toLowerCase();
  const dot = p.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTS.has(p.slice(dot));
}

function addCandidate(out: ImageRefReplacement[], from: string, to: string): void {
  const f = String(from ?? '').trim();
  const t = String(to ?? '').trim();
  if (!f || !t || f === t) return;
  if (out.some((x) => x.from === f && x.to === t)) return;
  out.push({ from: f, to: t });
}

/**
 * 根据一次文件重命名事件，计算当前文档里可能需要替换的图片引用字符串。
 * 注意：这是“保守修复”——只生成最可能命中的字符串候选，实际替换由 webview 执行。
 */
export function buildRenameImageRefReplacements(
  documentUri: vscode.Uri,
  files: ReadonlyArray<{ oldUri: vscode.Uri; newUri: vscode.Uri }>
): ImageRefReplacement[] {
  const out: ImageRefReplacement[] = [];

  for (const f of files) {
    if (!isLikelyImageFile(f.oldUri) || !isLikelyImageFile(f.newUri)) continue;

    const fromRel = toMarkdownImageRelativePath(documentUri, f.oldUri);
    const toRel = toMarkdownImageRelativePath(documentUri, f.newUri);

    addCandidate(out, fromRel, toRel);
    addCandidate(out, `./${fromRel}`, `./${toRel}`);

    // 处理空格等可能被编码的情况（常见：%20）
    addCandidate(out, encodeURI(fromRel), encodeURI(toRel));
    addCandidate(out, `./${encodeURI(fromRel)}`, `./${encodeURI(toRel)}`);
  }

  return out;
}

