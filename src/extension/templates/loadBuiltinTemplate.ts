import * as vscode from 'vscode';

/** 从扩展包内 `templates/<id>.md` 读取 UTF-8 正文 */
export async function loadBuiltinTemplateMarkdown(extensionUri: vscode.Uri, id: string): Promise<string> {
  const uri = vscode.Uri.joinPath(extensionUri, 'templates', `${id}.md`);
  const data = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(data).toString('utf-8');
}
