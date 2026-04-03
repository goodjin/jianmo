/**
 * Markly VS Code Extension Integration Tests
 *
 * 使用 @vscode/test-electron 进行集成测试
 * 这些测试会在真实的 VS Code 环境中运行
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as assert from 'assert';

const TEST_TIMEOUT = 60000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

suite('Markly Extension Integration Tests', () => {
  let testFilePath: string;

  setup(async () => {
    const tempDir = os.tmpdir();
    testFilePath = path.join(tempDir, `markly-int-${Date.now()}.md`);
    fs.writeFileSync(testFilePath, '# Test Document\n\nHello World', 'utf-8');
  });

  teardown(async () => {
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('Extension should be activated', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    assert.ok(extension, 'Extension should be defined');
    if (!extension.isActive) {
      await extension.activate();
    }
    assert.strictEqual(extension.isActive, true, 'Extension should be active');
  }).timeout(TEST_TIMEOUT);

  test('Should open markdown file', async () => {
    const doc = await vscode.workspace.openTextDocument(testFilePath);
    assert.ok(doc, 'Document should be defined');
    assert.strictEqual(doc.languageId, 'markdown', 'Language should be markdown');

    const editor = await vscode.window.showTextDocument(doc);
    assert.ok(editor, 'Editor should be defined');
    assert.strictEqual(editor.document.uri.fsPath, doc.uri.fsPath, 'Editor should show the correct document');
  }).timeout(TEST_TIMEOUT);

  test('Should toggle mode via modeController', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    if (!extension?.isActive) await extension?.activate();
    const exportsAny = extension?.exports as any;

    const doc = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.commands.executeCommand('vscode.openWith', doc.uri, 'markly.preview');
    await sleep(2000);

    await vscode.commands.executeCommand('markly.toggleMode');
    await sleep(500);

    const mode = exportsAny?.modeController?.getCurrentMode?.();
    assert.ok(mode === 'source' || mode === 'preview', `modeController.getCurrentMode() 应返回有效值，实际: ${String(mode)}`);
  }).timeout(TEST_TIMEOUT);

  test('All registered commands should be available', async () => {
    const commands = await vscode.commands.getCommands(true);
    const required = ['markly.toggleMode', 'markly.export.pdf', 'markly.export.html', 'markly.export.image'];
    for (const cmd of required) {
      assert.ok(commands.includes(cmd), `命令 ${cmd} 应已注册`);
    }
  }).timeout(TEST_TIMEOUT);
});

/**
 * generateAnchor 和 validateConfig 的真实行为已由 vitest 单元测试覆盖：
 * - src/core/export/__tests__/pdfExport.test.ts → generateAnchor
 * - src/extension/__tests__/configuration.test.ts → validateConfig
 * 此处不再重复内联假实现。
 */
