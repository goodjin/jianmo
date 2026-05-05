import * as path from 'path';
import * as vscode from 'vscode';
import { analyzeMarkdownExportPreflight } from '@core/export/exportPreflight';
import type { ExportPreflightScope } from '@types';

export function workspaceRootFsPathForExport(documentUri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(documentUri);
  return folder?.uri.fsPath ?? path.dirname(documentUri.fsPath);
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
}): Promise<boolean> {
  if (options.scope === 'off' || options.documentUri.scheme !== 'file') {
    return true;
  }

  const issues = analyzeMarkdownExportPreflight({
    markdown: options.markdown,
    sourceFileFsPath: options.documentUri.fsPath,
    workspaceRootFsPath: workspaceRootFsPathForExport(options.documentUri),
    scope: options.scope,
  });

  if (issues.length === 0) return true;

  const lines = issues.slice(0, 14).map((i) => `· ${i.message}`);
  const more = issues.length > 14 ? `\n… 共 ${issues.length} 条` : '';
  const body = `${options.formatLabel} 导出预检：发现 ${issues.length} 个问题\n${lines.join('\n')}${more}`;

  if (!options.blockOnIssues) {
    void vscode.window.showWarningMessage(body);
    return true;
  }

  const choice = await vscode.window.showWarningMessage(body, { modal: true }, '仍要导出', '取消');
  return choice === '仍要导出';
}
