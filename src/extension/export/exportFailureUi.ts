import * as path from 'path';
import * as vscode from 'vscode';
import { buildExportFailureDiagnosticsMarkdown } from '@core/export/exportDiagnostics';
import { formatExportFailure } from '@core/export/exportErrors';
import { t } from '../l10n';

let lastDiagnosticsMarkdown: string | null = null;

export function getLastExportFailureDiagnosticsMarkdown(): string | null {
  return lastDiagnosticsMarkdown;
}

export async function showExportFailureWithDiagnostics(
  context: vscode.ExtensionContext,
  format: 'pdf' | 'html',
  error: unknown,
  paths?: { documentPath?: string; outputPath?: string }
): Promise<void> {
  const md = buildExportFailureDiagnosticsMarkdown({
    format,
    error,
    documentBasename: paths?.documentPath ? path.basename(paths.documentPath) : undefined,
    outputBasename: paths?.outputPath ? path.basename(paths.outputPath) : undefined,
    vscodeVersion: vscode.version,
    extensionVersion: String((context.extension.packageJSON as { version?: string }).version ?? ''),
    platform: process.platform,
    arch: process.arch,
  });
  lastDiagnosticsMarkdown = md;

  const userMsg = formatExportFailure(format, error);
  const items: string[] = ['复制诊断包'];
  if (format === 'pdf') {
    items.push('查看日志');
  }
  const pick = await vscode.window.showErrorMessage(userMsg, ...items);
  if (pick === '复制诊断包') {
    await vscode.env.clipboard.writeText(md);
    void vscode.window.showInformationMessage(t('export.failure.diagnosticsCopied'));
  } else if (pick === '查看日志') {
    void vscode.commands.executeCommand('workbench.action.toggleDevTools');
  }
}

export async function runCopyLastExportFailureDiagnostics(): Promise<void> {
  const md = lastDiagnosticsMarkdown;
  if (!md) {
    void vscode.window.showWarningMessage(
      '暂无最近一次导出失败的诊断包。请先重试导出；若仍失败，可在错误提示中点击「复制诊断包」。'
    );
    return;
  }
  await vscode.env.clipboard.writeText(md);
  void vscode.window.showInformationMessage(t('export.failure.lastDiagnosticsCopied'));
}
