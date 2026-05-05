import * as vscode from 'vscode';
import * as path from 'path';
import {
  extractMarkdownLinkHrefs,
  pathsEqualFs,
  resolveMarkdownHrefToFsPath,
} from './markdownLinkRefs';

/** 单次扫描最多检查的 .md 文件数（超出则 truncated） */
export const MARKDOWN_BACKLINKS_MAX_FILES = 650;

const MAX_FILE_BYTES = 1_500_000;

export type MarkdownBacklinksFindResult = {
  items: Array<{ uri: string; workspaceRelativePath: string }>;
  error?: 'no_workspace';
  truncated?: boolean;
};

/**
 * 在工作区内查找「正文内链指向 targetUri」的其他 Markdown 文件（不含自身）。
 */
export async function findMarkdownBacklinksForDocument(
  targetUri: vscode.Uri,
  deps?: {
    findFiles: typeof vscode.workspace.findFiles;
    readFile: (uri: vscode.Uri) => Thenable<Uint8Array>;
  }
): Promise<MarkdownBacklinksFindResult> {
  const folder = vscode.workspace.getWorkspaceFolder(targetUri);
  if (!folder) {
    return { items: [], error: 'no_workspace' };
  }

  const findFilesImpl = deps?.findFiles ?? ((g, x, l) => vscode.workspace.findFiles(g, x, l));
  const readFileImpl =
    deps?.readFile ??
    ((u: vscode.Uri) => vscode.workspace.fs.readFile(u));

  const targetNorm = path.normalize(targetUri.fsPath);
  const workspaceRoot = folder.uri.fsPath;

  const exclude = '{**/node_modules/**,**/.git/**}';
  const files = await findFilesImpl(
    new vscode.RelativePattern(folder, '**/*.md'),
    exclude,
    MARKDOWN_BACKLINKS_MAX_FILES + 1
  );
  const truncated = files.length > MARKDOWN_BACKLINKS_MAX_FILES;
  const capped = truncated ? files.slice(0, MARKDOWN_BACKLINKS_MAX_FILES) : files;

  const found = new Map<string, vscode.Uri>();

  for (const fileUri of capped) {
    if (pathsEqualFs(fileUri.fsPath, targetNorm)) continue;

    let bytes: Uint8Array;
    try {
      bytes = await readFileImpl(fileUri);
    } catch {
      continue;
    }
    if (bytes.length > MAX_FILE_BYTES) continue;

    const text = Buffer.from(bytes).toString('utf8');
    const hrefs = extractMarkdownLinkHrefs(text);
    for (const href of hrefs) {
      const resolved = resolveMarkdownHrefToFsPath({
        sourceFileFsPath: fileUri.fsPath,
        href,
        workspaceRootFsPath: workspaceRoot,
      });
      if (!resolved) continue;
      if (pathsEqualFs(resolved, targetNorm)) {
        found.set(fileUri.fsPath, fileUri);
        break;
      }
    }
  }

  const sorted = [...found.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
  const items = sorted.map((u) => ({
    uri: u.toString(),
    workspaceRelativePath:
      path.relative(workspaceRoot, u.fsPath).replace(/\\/g, '/') || path.basename(u.fsPath),
  }));

  return { items, ...(truncated ? { truncated: true } : {}) };
}
