import * as vscode from 'vscode';
import { ModeController } from '@core/modeController';
import { DocumentStore } from '@core/documentStore';
import { ConfigurationStore } from './configuration';
import { MarkdownEditorProvider } from './provider/customEditor';
import { registerCommands } from './commands';
import type { ExtensionConfig } from '@types';

let modeController: ModeController | undefined;
let documentStore: DocumentStore | undefined;
let configStore: ConfigurationStore | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Markdown Editor is now active');

  // 首次激活提示：询问是否设为默认编辑器
  if (!context.globalState.get('hasShownDefaultEditorPrompt')) {
    const choice = await vscode.window.showInformationMessage(
      '是否将简墨设置为 Markdown 文件的默认编辑器？',
      '是',
      '否'
    );

    if (choice === '是') {
      try {
        const config = vscode.workspace.getConfiguration('workbench');
        const associations = config.get<Record<string, string>>('editorAssociations') || {};
        associations['*.md'] = 'md-editor.preview';
        await config.update('editorAssociations', associations, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('已将简墨设置为 Markdown 文件的默认编辑器');
      } catch (error) {
        console.error('Failed to set default editor:', error);
      }
    }

    await context.globalState.update('hasShownDefaultEditorPrompt', true);
  }

  // 初始化配置
  configStore = new ConfigurationStore();
  const config = configStore.getConfig();

  // 初始化文档存储
  documentStore = new DocumentStore();

  // 初始化模式控制器
  modeController = new ModeController(documentStore);

  // 注册自定义编辑器
  const provider = new MarkdownEditorProvider(context, documentStore, config);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'md-editor.preview',
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
  registerCommands(context, modeController, documentStore);

  // 监听配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mdEditor')) {
        configStore?.reload();
        // 通知 WebView 配置变化
        provider.notifyConfigChange(configStore.getConfig());
      }
    })
  );

  // 显示状态栏
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'mdEditor.toggleMode';
  statusBarItem.text = '$(markdown) MD Editor';
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
