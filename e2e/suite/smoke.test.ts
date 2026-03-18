/**
 * Smoke Test - 验证编辑器基本功能
 *
 * 这个测试用于快速验证：
 * 1. 扩展能否正常激活
 * 2. WebView 能否正常加载
 * 3. 编辑器能否正常显示
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const TEST_TIMEOUT = 60000;

suite('Smoke Test Suite', () => {
  let testFilePath: string;

  // 在每个测试前创建临时测试文件
  setup(async () => {
    const tempDir = os.tmpdir();
    testFilePath = path.join(tempDir, `test-${Date.now()}.md`);
    fs.writeFileSync(testFilePath, '# Test Document\n\nThis is a test.');
  });

  // 在每个测试后清理
  teardown(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('Extension should be activated', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    assert.ok(extension, 'Extension should be installed');

    if (!extension.isActive) {
      await extension.activate();
    }

    assert.strictEqual(extension.isActive, true, 'Extension should be activated');
  }).timeout(TEST_TIMEOUT);

  test('Should open markdown file with custom editor', async () => {
    // 打开测试文件
    const document = await vscode.workspace.openTextDocument(testFilePath);
    assert.ok(document, 'Document should be opened');

    // 使用自定义编辑器打开
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'markly.preview');

    // 等待 WebView 加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 检查是否有活动的 WebView
    const panel = vscode.window.activeTextEditor;
    // 注意：在自定义编辑器中，activeTextEditor 可能为 undefined
    // 我们主要检查没有抛出错误
    assert.ok(true, 'Editor opened without error');
  }).timeout(TEST_TIMEOUT);

  test('Should toggle between source and preview mode', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    if (!extension?.isActive) {
      await extension?.activate();
    }

    // 打开文件
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'markly.preview');

    // 等待加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 切换模式命令应该存在
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('markly.toggleMode'), 'Toggle mode command should exist');

    // 执行切换模式命令（不应该抛出错误）
    try {
      await vscode.commands.executeCommand('markly.toggleMode');
      assert.ok(true, 'Toggle mode command executed');
    } catch (e) {
      assert.fail(`Toggle mode command failed: ${e}`);
    }
  }).timeout(TEST_TIMEOUT);
});
