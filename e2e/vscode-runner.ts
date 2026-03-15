/**
 * VS Code Extension Test Runner
 * 
 * 使用 @vscode/test-electron 进行测试
 * 这个文件用于在真实的 VS Code 环境中运行测试
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function runTest(): Promise<void> {
  // 获取测试文件路径
  const testFile = path.join(__dirname, 'test-file.md');
  
  // 创建测试文件
  fs.writeFileSync(testFile, '# Test\n\nHello', 'utf-8');
  
  // 打开文件
  const doc = await vscode.workspace.openTextDocument(testFile);
  const editor = await vscode.window.showTextDocument(doc);
  
  // 等待加载
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 切换到预览模式
  await vscode.commands.executeCommand('markly.toggleMode');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 获取 WebView
  const webviewPanels = vscode.window.tabGroups.allTabs
    .flatMap(group => group.rows)
    .flatMap(row => row.tabs)
    .filter(tab => (tab as any).input instanceof vscode.WebviewPanel)
    .map(tab => (tab as any).input as vscode.WebviewPanel);
  
  console.log(`Found ${webviewPanels.length} webview panels`);
  
  // 清理
  fs.unlinkSync(testFile);
}
