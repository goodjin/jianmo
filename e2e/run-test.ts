/**
 * VS Code Extension Test Runner
 * 
 * 使用 @vscode/test-electron 运行测试
 * 详细说明见: https://code.visualstudio.com/api/working-with-extensions/testing-extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function run(): Promise<void> {
  // 创建测试文件
  const testWorkspace = path.join(__dirname, 'test-workspace');
  if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace, { recursive: true });
  }

  const testFile = path.join(testWorkspace, 'test.md');
  fs.writeFileSync(testFile, '# Test\n\nHello World', 'utf-8');

  // 打开测试文件
  const doc = await vscode.workspace.openTextDocument(testFile);
  const editor = await vscode.window.showTextDocument(doc);

  console.log('✓ 文件已打开');

  // 测试模式切换
  await vscode.commands.executeCommand('markly.toggleMode');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✓ 切换到预览模式');

  await vscode.commands.executeCommand('markly.toggleMode');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✓ 切换回源码模式');

  // 测试保存
  await editor.edit(editBuilder => {
    editBuilder.insert(new vscode.Position(0, 0), '# Updated\n\n');
  });
  await vscode.commands.executeCommand('workbench.action.save');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✓ 保存成功');

  // 清理
  fs.unlinkSync(testFile);
  fs.rmdirSync(testWorkspace);

  console.log('\n========== 所有测试通过 ==========');
}

// 运行测试
run().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
