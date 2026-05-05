import * as vscode from 'vscode';

/**
 * M94：打开随扩展打包的自救与排障文档（Markdown 预览）。
 */
export async function openRecoveryCenter(context: vscode.ExtensionContext): Promise<void> {
  const uri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'TROUBLESHOOTING.md');
  try {
    await vscode.commands.executeCommand('markdown.showPreview', uri);
  } catch {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
  }
}
