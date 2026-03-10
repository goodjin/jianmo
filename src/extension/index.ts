import * as vscode from 'vscode';
import { ModeController, type WebviewProvider } from '@core/modeController';
import { DocumentStore } from '@core/documentStore';
import { ConfigurationStore } from './configuration';
import { MarkdownEditorProvider } from './provider/customEditor';
import { registerCommands, getWebview } from './commands';
import type { ExtensionConfig } from '@types';

let modeController: ModeController | undefined;
let documentStore: DocumentStore | undefined;
let configStore: ConfigurationStore | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Markdown Editor is now active');

  // 首次激活提示：询问是否设为默认编辑器（使用 setTimeout 延迟显示，避免阻塞激活）
  if (!context.globalState.get('hasShownDefaultEditorPrompt')) {
    setTimeout(async () => {
      const choice = await vscode.window.showInformationMessage(
        'Set Markly as the default editor for Markdown files?',
        'Yes',
        'No'
      );

      if (choice === 'Yes') {
        try {
          const config = vscode.workspace.getConfiguration('workbench');
          const associations = config.get<Record<string, string>>('editorAssociations') || {};
          associations['*.md'] = 'markly.preview';
          await config.update('editorAssociations', associations, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage('Markly has been set as the default editor for Markdown files');
        } catch (error) {
          console.error('Failed to set default editor:', error);
        }
      }

      try {
        await context.globalState.update('hasShownDefaultEditorPrompt', true);
      } catch (error) {
        console.error('Failed to update globalState:', error);
      }
    }, 1000);
  }

  // 初始化配置
  configStore = new ConfigurationStore();
  const config = configStore.getConfig();

  // 初始化文档存储
  documentStore = new DocumentStore();

  // 创建 WebView provider
  const webviewProvider: WebviewProvider = {
    getWebview: (uri: string) => getWebview(uri),
  };

  // 初始化模式控制器
  modeController = new ModeController(documentStore, webviewProvider);

  // 注册自定义编辑器
  const provider = new MarkdownEditorProvider(context, documentStore, config);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'markly.preview',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // 注册命令
  registerCommands(context, modeController);

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markly')) {
        configStore?.reload();
        // 修复：添加空检查，防止 provider 未初始化时崩溃
        provider?.notifyConfigChange(configStore?.getConfig());
      }
    })
  );

  // 显示状态栏
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'markly.toggleMode';
  statusBarItem.text = '$(markdown) Markly';
  statusBarItem.tooltip = 'Toggle Edit Mode';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate(): void {
  modeController?.dispose();
  documentStore?.dispose();
  configStore?.dispose();
  console.log('Markdown Editor deactivated');
}

export { modeController, documentStore, configStore };
