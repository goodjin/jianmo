import * as vscode from 'vscode';
import { ModeController, type WebviewProvider } from '@core/modeController';
import { DocumentStore } from '@core/documentStore';
import { ConfigurationStore } from './configuration';
import { MarkdownEditorProvider } from './provider/customEditor';
import { registerCommands, getWebview } from './commands';
import type { ExtensionMessage } from '@types';
import { buildRenameImageRefReplacements } from './image/renameImageRefs';
import { validateAiRewriteSetup } from './ai/validateAiRewriteConfig';

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
  const provider = new MarkdownEditorProvider(context, documentStore, config, modeController);
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
  registerCommands(context, modeController, documentStore);

  // M71：AI 配置校验命令（避免用户改 settings 后不知为何失败）
  context.subscriptions.push(
    vscode.commands.registerCommand('markly.ai.validateSetup', async () => {
      if (!configStore) return;
      const cfg = configStore.getConfig();
      const issues = await validateAiRewriteSetup(context, cfg);
      const actionable = issues.filter((x) => x.code !== 'disabled');
      if (actionable.length === 0) {
        vscode.window.showInformationMessage('AI 配置看起来没问题。');
        return;
      }
      const msg = actionable.map((x) => `- ${x.message}`).join('\n');
      const choice = await vscode.window.showWarningMessage(`AI 配置需要检查：\n${msg}`, '设置 API Key', '打开设置');
      if (choice === '设置 API Key') {
        await vscode.commands.executeCommand('markly.ai.setApiKey');
      } else if (choice === '打开设置') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markly.ai.rewrite');
      }
    })
  );

  // M51：监听文件重命名/移动，提示并修复当前文档中的本地图片引用
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      try {
        const editor = vscode.window.activeTextEditor;
        const doc = editor?.document;
        if (!doc || doc.languageId !== 'markdown') return;

        const files = e.files ?? [];
        if (files.length === 0) return;

        const replacements = buildRenameImageRefReplacements(
          doc.uri,
          files.map((x) => ({ oldUri: x.oldUri, newUri: x.newUri }))
        );
        if (replacements.length === 0) return;

        const choice = await vscode.window.showInformationMessage(
          `检测到图片文件重命名/移动。是否尝试修复当前文档中的图片引用？`,
          '修复当前文档',
          '忽略'
        );
        if (choice !== '修复当前文档') return;

        // 逐个替换（webview 侧会提示“未找到可替换内容”/“已替换 N 处”）
        const webview = getWebview(doc.uri.toString());
        if (!webview) {
          vscode.window.showInformationMessage('请先用 Markly 打开当前 Markdown 文件，再执行图片引用修复。');
          return;
        }

        for (const r of replacements) {
          await webview.postMessage({
            type: 'EDITOR_COMMAND',
            payload: { command: 'documentReplace', from: r.from, to: r.to },
          } as ExtensionMessage);
        }
      } catch (err) {
        console.error('[M51] rename image ref repair failed', err);
      }
    })
  );

  // 监听配置变化
  const aiWarned = new Set<string>();
  let aiValidateTimer: ReturnType<typeof setTimeout> | null = null;
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markly')) {
        configStore?.reload();
        // 修复：添加空检查，防止 provider 未初始化时崩溃
        provider?.notifyConfigChange(configStore?.getConfig());

        // M71：当 AI 相关设置变化时做一次轻量校验提示（仅提示一次，避免刷屏）
        if (
          e.affectsConfiguration('markly.ai.rewrite.enabled') ||
          e.affectsConfiguration('markly.ai.rewrite.provider') ||
          e.affectsConfiguration('markly.ai.rewrite.endpoint') ||
          e.affectsConfiguration('markly.ai.rewrite.model') ||
          e.affectsConfiguration('markly.ai.rewrite.timeoutMs')
        ) {
          if (aiValidateTimer) clearTimeout(aiValidateTimer);
          aiValidateTimer = setTimeout(async () => {
            aiValidateTimer = null;
            if (!configStore) return;
            const cfg = configStore.getConfig();
            const issues = await validateAiRewriteSetup(context, cfg);
            const actionable = issues.filter((x) => x.code !== 'disabled');
            if (actionable.length === 0) return;
            const sig = actionable.map((x) => x.code).sort().join(',');
            if (aiWarned.has(sig)) return;
            aiWarned.add(sig);
            const msg = actionable.map((x) => `- ${x.message}`).join('\n');
            const choice = await vscode.window.showWarningMessage(
              `AI 配置可能不完整：\n${msg}`,
              '设置 API Key',
              '打开设置',
              '稍后'
            );
            if (choice === '设置 API Key') {
              await vscode.commands.executeCommand('markly.ai.setApiKey');
            } else if (choice === '打开设置') {
              await vscode.commands.executeCommand('workbench.action.openSettings', 'markly.ai.rewrite');
            }
          }, 350);
        }
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
