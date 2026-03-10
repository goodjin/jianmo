import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ModeController } from '@core/modeController';
import type { ExtensionMessage } from '@types';
import { exportToPdf } from '@core/export/pdfExport';
import { exportToHtml } from '@core/export/htmlExport';

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
  modeController: ModeController
): void {
  // 切换模式 - 发送消息到 WebView
  const toggleModeCmd = vscode.commands.registerCommand(
    'markly.toggleMode',
    async () => {
      try {
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
              'markly.preview'
            );
          } else {
            vscode.window.showInformationMessage(
              'Please open a Markdown file first'
            );
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `切换模式失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // 导出 PDF
  const exportPdfCmd = vscode.commands.registerCommand(
    'markly.export.pdf',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // 选择保存位置
      const defaultUri = vscode.Uri.file(
        editor.document.fileName.replace(/(\.md)$/, '.pdf')
      );
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'PDF': ['pdf'],
        },
      });

      if (!saveUri) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '导出 PDF...',
          cancellable: false,
        },
        async () => {
          try {
            const content = editor.document.getText();
            await exportToPdf(content, saveUri.fsPath, {
              includeToc: true,
              displayHeaderFooter: true,
            });
            vscode.window.showInformationMessage(`PDF 已导出: ${path.basename(saveUri.fsPath)}`);
          } catch (error) {
            vscode.window.showErrorMessage(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      );
    }
  );

  // 导出 HTML
  const exportHtmlCmd = vscode.commands.registerCommand(
    'markly.export.html',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // 选择保存位置
      const defaultUri = vscode.Uri.file(
        editor.document.fileName.replace(/(\.md)$/, '.html')
      );
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'HTML': ['html'],
        },
      });

      if (!saveUri) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '导出 HTML...',
          cancellable: false,
        },
        async () => {
          try {
            const content = editor.document.getText();
            // 从文件名前提取标题
            const title = path.basename(editor.document.fileName, '.md');
            await exportToHtml(content, saveUri.fsPath, {
              includeToc: true,
              title,
            });
            vscode.window.showInformationMessage(`HTML 已导出: ${path.basename(saveUri.fsPath)}`);
          } catch (error) {
            vscode.window.showErrorMessage(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      );
    }
  );

  // 导出图片
  const exportImageCmd = vscode.commands.registerCommand(
    'markly.export.image',
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
