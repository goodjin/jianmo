import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ModeController } from '@core/modeController';
import type { ExtensionMessage, PdfConfig, RichTableCommandValue } from '@types';
import { exportToPdf, pdfExportOptionsFromPdfConfig } from '@core/export/pdfExport';
import { exportToHtml } from '@core/export/htmlExport';
import { toMarkdownImageRelativePath } from '@extension/provider/imagePaths';
import { clearAiApiKey, setAiApiKey } from '@extension/ai/rewriteSelection';

// 存储所有 WebView 的引用
const webviews = new Map<string, vscode.Webview>();

const richTableCommands: Array<{ id: string; op: RichTableCommandValue }> = [
  { id: 'markly.table.addRowBefore', op: 'addRowBefore' },
  { id: 'markly.table.addRowAfter', op: 'addRowAfter' },
  { id: 'markly.table.addColBefore', op: 'addColBefore' },
  { id: 'markly.table.addColAfter', op: 'addColAfter' },
  { id: 'markly.table.toggleHeaderRow', op: 'toggleHeaderRow' },
  { id: 'markly.table.alignLeft', op: 'alignLeft' },
  { id: 'markly.table.alignCenter', op: 'alignCenter' },
  { id: 'markly.table.alignRight', op: 'alignRight' },
  { id: 'markly.table.mergeCells', op: 'mergeCells' },
  { id: 'markly.table.splitCell', op: 'splitCell' },
  { id: 'markly.table.deleteTable', op: 'deleteTable' },
  { id: 'markly.table.deleteRow', op: 'deleteRow' },
  { id: 'markly.table.deleteCol', op: 'deleteCol' },
];

const imageAssetCommands = [
  { id: 'markly.image.copyMissingRefs', value: 'copyMissingRefs' },
  { id: 'markly.image.openAssetsDirectory', value: 'openAssetsDirectory' },
  { id: 'markly.image.repairFirstMissingRef', value: 'repairFirstMissingRef' },
  { id: 'markly.image.normalizeRefs', value: 'normalizeImageRefs' },
] as const;

export function registerWebview(uri: string, webview: vscode.Webview): void {
  webviews.set(uri, webview);
}

export function getWebview(uri: string): vscode.Webview | undefined {
  return webviews.get(uri);
}

export function getAllWebviews(): Map<string, vscode.Webview> {
  return webviews;
}

export function unregisterWebview(uri: string): void {
  webviews.delete(uri);
}

async function postEditorCommand(payload: Extract<ExtensionMessage, { type: 'EDITOR_COMMAND' }>['payload']): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const activeUri = editor?.document.uri.toString();
  const webview =
    (activeUri ? webviews.get(activeUri) : undefined) ??
    (webviews.size === 1 ? Array.from(webviews.values())[0] : undefined);

  if (!webview) {
    vscode.window.showInformationMessage('请先用 Markly 打开一个 Markdown 文件。');
    return;
  }

  await webview.postMessage({ type: 'EDITOR_COMMAND', payload } as ExtensionMessage);
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
        async (progress) => {
          try {
            progress.report({ message: '正在准备内容...' });
            const content = editor.document.getText();

            progress.report({ message: '正在生成 PDF...' });
            console.log('[PDF Export] Starting export to:', saveUri.fsPath);

            const vs = vscode.workspace.getConfiguration('markly');
            const margin = vs.get<PdfConfig['margin']>('export.pdf.margin', {
              top: 25,
              right: 20,
              bottom: 25,
              left: 20,
            });
            const pdfCfg: PdfConfig = {
              format: vs.get<PdfConfig['format']>('export.pdf.format', 'A4'),
              margin: {
                top: margin?.top ?? 25,
                right: margin?.right ?? 20,
                bottom: margin?.bottom ?? 25,
                left: margin?.left ?? 20,
              },
              includeToc: vs.get<boolean>('export.pdf.includeToc', true),
              displayHeaderFooter: vs.get<boolean>('export.pdf.displayHeaderFooter', true),
            };
            const baseHref = vscode.Uri.file(path.dirname(editor.document.fileName)).toString(true) + '/';
            await exportToPdf(content, saveUri.fsPath, pdfExportOptionsFromPdfConfig(pdfCfg, baseHref));

            // 验证文件是否生成
            const fs = require('fs');
            if (fs.existsSync(saveUri.fsPath)) {
              const stats = fs.statSync(saveUri.fsPath);
              console.log('[PDF Export] Success! File size:', stats.size, 'bytes');
              vscode.window.showInformationMessage(
                `PDF 导出成功! (${(stats.size / 1024).toFixed(1)} KB)`,
                '打开文件'
              ).then(selection => {
                if (selection === '打开文件') {
                  vscode.env.openExternal(vscode.Uri.file(saveUri.fsPath));
                }
              });
            } else {
              throw new Error('文件未生成');
            }
          } catch (error) {
            console.error('[PDF Export] Error:', error);
            vscode.window.showErrorMessage(
              `PDF 导出失败: ${error instanceof Error ? error.message : String(error)}`,
              '查看日志'
            ).then(selection => {
              if (selection === '查看日志') {
                vscode.commands.executeCommand('workbench.action.toggleDevTools');
              }
            });
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
            const htmlTheme =
              vscode.workspace.getConfiguration('markly').get<'default' | 'print-friendly'>('export.html.theme', 'default') ??
              'default';
            await exportToHtml(content, saveUri.fsPath, {
              includeToc: true,
              title,
              htmlTheme,
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

  const toggleOutlineCmd = vscode.commands.registerCommand(
    'markly.toggleOutline',
    () => postEditorCommand({ command: 'toggleOutline' })
  );

  const toggleFindReplaceCmd = vscode.commands.registerCommand(
    'markly.find.toggle',
    () => postEditorCommand({ command: 'toggleFindReplace' })
  );

  const findNextCmd = vscode.commands.registerCommand('markly.find.next', () =>
    postEditorCommand({ command: 'findNavigate', direction: 'next' })
  );

  const findPreviousCmd = vscode.commands.registerCommand('markly.find.previous', () =>
    postEditorCommand({ command: 'findNavigate', direction: 'previous' })
  );

  const pastePlainCmd = vscode.commands.registerCommand('markly.edit.pastePlain', () =>
    postEditorCommand({ command: 'pastePlain' })
  );

  const wrapUrlLinkCmd = vscode.commands.registerCommand('markly.edit.wrapUrlLink', () =>
    postEditorCommand({ command: 'wrapUrlLink' })
  );

  const imageBatchReplaceCmd = vscode.commands.registerCommand(
    'markly.image.batchReplaceInDocument',
    async () => {
      const from = await vscode.window.showInputBox({
        title: '批量替换',
        prompt: '将文档中以下内容全部替换（例如图片路径片段）',
        placeHolder: './old.png',
      });
      if (from === undefined) return;
      const trimmed = from.trim();
      if (!trimmed) {
        vscode.window.showWarningMessage('查找内容不能为空。');
        return;
      }
      const to = await vscode.window.showInputBox({
        title: '批量替换',
        prompt: '替换为',
        placeHolder: './new.png',
      });
      if (to === undefined) return;
      await postEditorCommand({ command: 'documentReplace', from: trimmed, to });
    }
  );

  const imageReplaceMovedRefCmd = vscode.commands.registerCommand('markly.image.replaceMovedImageRef', async () => {
    const editor = vscode.window.activeTextEditor;
    const docUri = editor?.document?.uri;
    if (!docUri) {
      vscode.window.showInformationMessage('请先打开一个 Markdown 文件。');
      return;
    }

    const pick = async (title: string) => {
      const sel = await vscode.window.showOpenDialog({
        title,
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
      });
      return sel?.[0];
    };

    const oldUri = await pick('选择“旧”的图片文件（移动/重命名前）');
    if (!oldUri) return;
    const newUri = await pick('选择“新”的图片文件（移动/重命名后）');
    if (!newUri) return;

    const from = toMarkdownImageRelativePath(docUri, oldUri);
    const to = toMarkdownImageRelativePath(docUri, newUri);
    await postEditorCommand({ command: 'documentReplace', from, to });
  });

  const insertTableCmd = vscode.commands.registerCommand(
    'markly.insert.table',
    () => postEditorCommand({ command: 'insert', value: 'table' })
  );

  const insertCodeBlockCmd = vscode.commands.registerCommand(
    'markly.insert.codeBlock',
    () => postEditorCommand({ command: 'insert', value: 'codeBlock' })
  );

  const richTableCmds = richTableCommands.map(({ id, op }) =>
    vscode.commands.registerCommand(id, () => postEditorCommand({ command: 'richTable', value: op }))
  );

  const imageAssetCmds = imageAssetCommands.map(({ id, value }) =>
    vscode.commands.registerCommand(id, () => postEditorCommand({ command: 'imageAsset', value }))
  );

  const insertImageCmd = vscode.commands.registerCommand(
    'markly.insert.image',
    () => postEditorCommand({ command: 'insert', value: 'image' })
  );

  const insertLinkCmd = vscode.commands.registerCommand(
    'markly.insert.link',
    () => postEditorCommand({ command: 'insert', value: 'link' })
  );

  const insertHrCmd = vscode.commands.registerCommand(
    'markly.insert.hr',
    () => postEditorCommand({ command: 'insert', value: 'hr' })
  );

  const assistSummarizeCmd = vscode.commands.registerCommand(
    'markly.assist.summarize',
    () => postEditorCommand({ command: 'writingAssist', value: 'summarize' })
  );

  const assistSuggestTitleCmd = vscode.commands.registerCommand(
    'markly.assist.suggestTitle',
    () => postEditorCommand({ command: 'writingAssist', value: 'suggestTitle' })
  );

  const assistFixMarkdownCmd = vscode.commands.registerCommand(
    'markly.assist.fixMarkdown',
    () => postEditorCommand({ command: 'writingAssist', value: 'fixMarkdown' })
  );

  const assistTidyTablesCmd = vscode.commands.registerCommand(
    'markly.assist.tidyTables',
    () => postEditorCommand({ command: 'writingAssist', value: 'tidyTables' })
  );

  const assistRewriteSelectionCmd = vscode.commands.registerCommand(
    'markly.assist.rewriteSelection',
    () => postEditorCommand({ command: 'writingAssist', value: 'rewriteSelection' })
  );

  const aiSetApiKeyCmd = vscode.commands.registerCommand('markly.ai.setApiKey', () => setAiApiKey(context));
  const aiClearApiKeyCmd = vscode.commands.registerCommand('markly.ai.clearApiKey', () => clearAiApiKey(context));

  context.subscriptions.push(
    toggleModeCmd,
    exportPdfCmd,
    exportHtmlCmd,
    exportImageCmd,
    toggleOutlineCmd,
    toggleFindReplaceCmd,
    findNextCmd,
    findPreviousCmd,
    pastePlainCmd,
    wrapUrlLinkCmd,
    imageBatchReplaceCmd,
    imageReplaceMovedRefCmd,
    insertTableCmd,
    insertCodeBlockCmd,
    insertImageCmd,
    insertLinkCmd,
    insertHrCmd,
    ...imageAssetCmds,
    ...richTableCmds,
    assistSummarizeCmd,
    assistSuggestTitleCmd,
    assistFixMarkdownCmd,
    assistTidyTablesCmd,
    assistRewriteSelectionCmd,
    aiSetApiKeyCmd,
    aiClearApiKeyCmd
  );
}
