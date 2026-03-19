/**
 * VS Code 扩展入口
 * @module extension/extension
 * @description 扩展激活入口和命令注册
 */

import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editorProvider';

/**
 * 扩展激活函数
 * @param context - 扩展上下文
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Markly extension activating...');

  // 创建 Editor Provider
  const provider = new MarkdownEditorProvider(context);

  // 注册 Custom Text Editor Provider
  const registration = vscode.window.registerCustomEditorProvider(
    'markly.editor',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    }
  );

  context.subscriptions.push(registration);

  // 注册切换模式命令
  context.subscriptions.push(
    vscode.commands.registerCommand('markly.toggleMode', () => {
      provider.postMessageToActiveWebview({
        type: 'COMMAND',
        payload: { command: 'toggleMode' },
      });
    })
  );

  // 注册显示大纲命令
  context.subscriptions.push(
    vscode.commands.registerCommand('markly.toggleOutline', () => {
      provider.postMessageToActiveWebview({
        type: 'COMMAND',
        payload: { command: 'toggleOutline' },
      });
    })
  );

  console.log('Markly extension activated');
}

/**
 * 扩展停用函数
 */
export function deactivate(): void {
  console.log('Markly extension deactivated');
}
