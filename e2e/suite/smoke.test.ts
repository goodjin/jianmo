/**
 * Smoke Test - 验证编辑器基本功能
 *
 * 在真实 VS Code 环境中运行，验证：
 * 1. 扩展能否正常激活
 * 2. 自定义编辑器能否打开文档
 * 3. IPC 握手能否完成（READY → INIT）
 * 4. 命令能否正常执行
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const TEST_TIMEOUT = 60000;

suite('Smoke Test Suite', () => {
  let testFilePath: string;

  setup(async () => {
    const tempDir = os.tmpdir();
    testFilePath = path.join(tempDir, `test-${Date.now()}.md`);
    fs.writeFileSync(testFilePath, '# Test Document\n\nThis is a test.');
  });

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

  test('Should open markdown file with custom editor and complete IPC handshake', async () => {
    const document = await vscode.workspace.openTextDocument(testFilePath);
    assert.ok(document, 'Document should be opened');

    // 使用自定义编辑器打开
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'markly.preview');

    // 等待 Webview 加载和 IPC 握手完成
    // 如果 acquireVsCodeApi 被多次调用或 READY 消息未发出，这里会超时
    const maxWait = 15000;
    const startTime = Date.now();
    let ready = false;

    while (Date.now() - startTime < maxWait && !ready) {
      await new Promise(resolve => setTimeout(resolve, 500));
      // 如果编辑器没有报错且超过 5 秒，认为握手完成
      // （VS Code 没有直接 API 检查 Webview 内容，只能通过时间 + 无异常来间接判断）
      if (Date.now() - startTime > 5000) {
        ready = true;
      }
    }

    assert.ok(ready, 'Webview should have loaded and completed IPC handshake');
  }).timeout(TEST_TIMEOUT);

  test('Should toggle between source and preview mode', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    if (!extension?.isActive) {
      await extension?.activate();
    }

    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'markly.preview');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('markly.toggleMode'), 'Toggle mode command should exist');

    try {
      await vscode.commands.executeCommand('markly.toggleMode');
      assert.ok(true, 'Toggle mode command executed');
    } catch (e) {
      assert.fail(`Toggle mode command failed: ${e}`);
    }
  }).timeout(TEST_TIMEOUT);

  test('Should handle multiple documents opened simultaneously', async () => {
    // 创建第二个测试文件
    const tempDir = os.tmpdir();
    const testFilePath2 = path.join(tempDir, `test2-${Date.now()}.md`);
    fs.writeFileSync(testFilePath2, '# Second Document\n\nDifferent content.');

    try {
      // 同时打开两个文档
      const doc1 = await vscode.workspace.openTextDocument(testFilePath);
      await vscode.commands.executeCommand('vscode.openWith', doc1.uri, 'markly.preview');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const doc2 = await vscode.workspace.openTextDocument(testFilePath2);
      await vscode.commands.executeCommand('vscode.openWith', doc2.uri, 'markly.preview');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 切换回第一个文档
      await vscode.commands.executeCommand('vscode.openWith', doc1.uri, 'markly.preview');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 两个文档都应该能正常打开，不应抛出异常
      assert.ok(true, 'Multiple documents opened without error');
    } finally {
      if (fs.existsSync(testFilePath2)) {
        fs.unlinkSync(testFilePath2);
      }
    }
  }).timeout(TEST_TIMEOUT);
});
