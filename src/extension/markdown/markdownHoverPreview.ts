import * as vscode from 'vscode';
import * as path from 'path';
import { resolveMarkdownHrefToFsPath } from './markdownLinkRefs';

type HeadingRow = {
  level: number;
  text: string;
  fromLine: number;
  customId?: string;
  slugId: string;
};

function cleanHeadingText(text: string): string {
  return String(text ?? '').replace(/\s+\{#[^}]+\}\s*$/, '').trim();
}

function extractCustomId(text: string): string | undefined {
  const m = String(text ?? '').match(/\s+\{#([^}]+)\}\s*$/);
  const id = (m?.[1] ?? '').trim();
  return id ? id : undefined;
}

function generateHeadingId(text: string): string {
  return cleanHeadingText(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseHeadings(md: string): HeadingRow[] {
  const lines = String(md ?? '').split('\n');
  const out: HeadingRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const raw = m[2] ?? '';
    const customId = extractCustomId(raw);
    const text = cleanHeadingText(raw);
    out.push({
      level: m[1]!.length,
      text,
      fromLine: i,
      customId,
      slugId: generateHeadingId(text),
    });
  }
  return out;
}

function extractExcerpt(md: string, headingLine: number, headingLevel: number): string {
  const lines = String(md ?? '').split('\n');
  const start = headingLine + 1;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = (lines[i] ?? '').match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const lvl = m[1]!.length;
    if (lvl <= headingLevel) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end).join('\n').trim();
  return block.replace(/\n{3,}/g, '\n\n').slice(0, 420);
}

export type MarkdownHoverPreviewResult = {
  ok: boolean;
  title?: string;
  excerpt?: string;
  targetUri?: string;
  error?: string;
};

export async function computeMarkdownHoverPreview(opts: {
  sourceDocumentUri: vscode.Uri;
  href: string;
}): Promise<MarkdownHoverPreviewResult> {
  const href = String(opts.href ?? '').trim();
  if (!href) return { ok: false, error: 'empty href' };

  const folder = vscode.workspace.getWorkspaceFolder(opts.sourceDocumentUri);
  if (!folder) return { ok: false, error: 'no_workspace' };

  const fragment = href.includes('#') ? (href.split('#')[1] ?? '').trim() : '';
  const base = href.split('#')[0]?.split('?')[0]?.trim() ?? '';
  const targetUri =
    href.startsWith('#') || !base
      ? opts.sourceDocumentUri
      : vscode.Uri.file(
          resolveMarkdownHrefToFsPath({
            sourceFileFsPath: opts.sourceDocumentUri.fsPath,
            href,
            workspaceRootFsPath: folder.uri.fsPath,
          }) ?? ''
        );

  if (!targetUri.fsPath) return { ok: false, error: 'unresolvable' };

  // 只允许打开工作区内 .md
  if (!/\.md$/i.test(targetUri.fsPath)) return { ok: false, error: 'not_markdown' };
  const within = path
    .normalize(targetUri.fsPath)
    .startsWith(path.normalize(folder.uri.fsPath + path.sep));
  if (!within && path.normalize(targetUri.fsPath) !== path.normalize(folder.uri.fsPath)) {
    return { ok: false, error: 'out_of_workspace' };
  }

  let bytes: Uint8Array;
  try {
    bytes = await vscode.workspace.fs.readFile(targetUri);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e ?? 'read failed') };
  }
  const md = Buffer.from(bytes).toString('utf8');
  const hs = parseHeadings(md);

  let chosen: HeadingRow | undefined;
  if (fragment) {
    chosen = hs.find((h) => h.customId === fragment) ?? hs.find((h) => h.slugId === fragment);
  }
  if (!chosen) {
    chosen = hs[0];
  }
  if (!chosen) {
    return { ok: true, title: path.basename(targetUri.fsPath), excerpt: md.slice(0, 420), targetUri: targetUri.toString() };
  }

  const excerpt = extractExcerpt(md, chosen.fromLine, chosen.level);
  return {
    ok: true,
    title: chosen.text,
    excerpt,
    targetUri: targetUri.toString(),
  };
}

