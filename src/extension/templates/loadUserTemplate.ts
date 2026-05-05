import * as vscode from 'vscode';
import * as path from 'path';
import { isResolvedPathUnderDir } from '@core/export/htmlBundleImages';

/**
 * 读取用户目录下的模板文件；必须落在 `trustedRoot`（已展开的真实目录）之下，防止路径穿越。
 */
export async function readUserTemplateMarkdownVerified(
  absoluteFilePath: string,
  trustedRootExpanded: string
): Promise<string> {
  const root = path.resolve(trustedRootExpanded);
  const file = path.resolve(absoluteFilePath);
  if (!isResolvedPathUnderDir(file, root)) {
    throw new Error('模板文件不在配置的自定义模板目录内');
  }
  const data = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
  return Buffer.from(data).toString('utf-8');
}
