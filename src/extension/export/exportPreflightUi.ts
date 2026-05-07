import * as path from 'path';
import * as vscode from 'vscode';
import { analyzeMarkdownExportPreflight, type ExportPreflightIssue } from '@core/export/exportPreflight';
import type { ExportPreflightScope } from '@types';
import { t } from '../l10n';

export function workspaceRootFsPathForExport(documentUri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(documentUri);
  return folder?.uri.fsPath ?? path.dirname(documentUri.fsPath);
}

async function revealFirstPreflightIssueInEditor(documentUri: vscode.Uri, issues: ExportPreflightIssue[]): Promise<void> {
  const line1 = issues.map((i) => i.sourceLine).find((ln) => typeof ln === 'number' && ln >= 1);
  const doc = await vscode.workspace.openTextDocument(documentUri);
  const editor = await vscode.window.showTextDocument(doc, { preserveFocus: false });
  if (typeof line1 === 'number') {
    const zero = Math.max(0, line1 - 1);
    const pos = new vscode.Position(zero, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
}

/**
 * 导出前预检；有问题时非阻塞弹警告，或阻塞并等待用户确认。
 * @returns 是否继续导出
 */
export async function confirmContinueAfterExportPreflight(options: {
  markdown: string;
  documentUri: vscode.Uri;
  scope: ExportPreflightScope;
  blockOnIssues: boolean;
  formatLabel: string;
  remoteHttpsHostsAllowlist?: string[];
}): Promise<boolean> {
  if (options.scope === 'off' || options.documentUri.scheme !== 'file') {
    return true;
  }

  const issues = analyzeMarkdownExportPreflight({
    markdown: options.markdown,
    sourceFileFsPath: options.documentUri.fsPath,
    workspaceRootFsPath: workspaceRootFsPathForExport(options.documentUri),
    scope: options.scope,
    remoteHttpsHostsAllowlist: options.remoteHttpsHostsAllowlist,
  });

  if (issues.length === 0) return true;

  const lines = issues.slice(0, 14).map((i) => {
    const ln = typeof i.sourceLine === 'number' ? `（约 L${i.sourceLine}）` : '';
    return `· ${i.message}${ln}`;
  });
  const more = issues.length > 14 ? `\n… 共 ${issues.length} 条` : '';
  const body = `${options.formatLabel} 导出预检：发现 ${issues.length} 个问题\n${lines.join('\n')}${more}`;

  if (!options.blockOnIssues) {
    const openAndReveal = t('export.preflight.openAndReveal');
    void vscode.window.showWarningMessage(body, openAndReveal).then((pick) => {
      if (pick === openAndReveal) void revealFirstPreflightIssueInEditor(options.documentUri, issues);
    });
    return true;
  }

  const exportAnyway = t('export.preflight.exportAnyway');
  const openAndReveal = t('export.preflight.openAndReveal');
  const cancel = t('export.preflight.cancel');
  const choice = await vscode.window.showWarningMessage(body, { modal: true }, exportAnyway, openAndReveal, cancel);
  if (choice === openAndReveal) {
    await revealFirstPreflightIssueInEditor(options.documentUri, issues);
    return false;
  }
  if (choice === exportAnyway) return true;
  return false;
}
