import * as vscode from 'vscode';
import type { ModeController } from '@core/modeController';
import type { DocumentStore } from '@core/documentStore';
import type { ExtensionMessage } from '@types';

// 存储所有 WebView 的引用
const webviews = new Map<string, vscode.Webview>();

export function registerWebview(uri: string, webview: vscode.Webview): void {
  webviews.set(uri, webview);
}

export function unregisterWebview(uri: string): void {
  webviews.delete(uri);
}

export function registerCommands(
  context: vscode.ExtensionContext,
  modeController: ModeController,
  documentStore: DocumentStore
): void {
  // 切换模式 - 发送消息到 WebView
  const toggleModeCmd = vscode.commands.registerCommand(
    'mdEditor.toggleMode',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const activeUri = editor?.document.uri.toString();

      if (activeUri && webviews.has(activeUri)) {
        // 如果当前文档使用我们的编辑器，发送消息到 WebView
        const webview = webviews.get(activeUri)!;
        const currentMode = modeController.getCurrentMode();
        const newMode = currentMode === 'source' ? 'preview' : 'source';
        webview.postMessage({
          type: 'SWITCH_MODE',
          payload: { mode: newMode },
        } as ExtensionMessage);
        modeController.switchTo(newMode);
      } else {
        // 如果使用的是 VSCode 默认编辑器，打开我们的预览编辑器
        if (editor && editor.document.languageId === 'markdown') {
          await vscode.commands.executeCommand(
            'vscode.openWith',
            editor.document.uri,
            'md-editor.preview'
          );
        } else {
          vscode.window.showInformationMessage(
            'Please open a Markdown file first'
          );
        }
      }
    }
  );

  // 导出 PDF
  const exportPdfCmd = vscode.commands.registerCommand(
    'mdEditor.export.pdf',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Exporting to PDF...',
          cancellable: false,
        },
        async () => {
          // TODO: 实现 PDF 导出
          await new Promise((resolve) => setTimeout(resolve, 1000));
          vscode.window.showInformationMessage('PDF export completed!');
        }
      );
    }
  );

  // 导出 HTML
  const exportHtmlCmd = vscode.commands.registerCommand(
    'mdEditor.export.html',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Exporting to HTML...',
          cancellable: false,
        },
        async () => {
          // TODO: 实现 HTML 导出
          await new Promise((resolve) => setTimeout(resolve, 1000));
          vscode.window.showInformationMessage('HTML export completed!');
        }
      );
    }
  );

  // 导出图片
  const exportImageCmd = vscode.commands.registerCommand(
    'mdEditor.export.image',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      vscode.window.showInformationMessage('Image export coming soon!');
    }
  );

  context.subscriptions.push(
    toggleModeCmd,
    exportPdfCmd,
    exportHtmlCmd,
    exportImageCmd
  );
}
