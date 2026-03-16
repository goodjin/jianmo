/**
 * VS Code Extension Tests
 *
 * 使用 VS Code API 进行扩展测试
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 测试配置
const TEST_TIMEOUT = 60000;

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should be activated', async () => {
    const extension = vscode.extensions.getExtension('jianmo.markly');
    assert.ok(extension, 'Extension should be installed');

    if (!extension.isActive) {
      await extension.activate();
    }

    assert.strictEqual(extension.isActive, true, 'Extension should be activated');
  });

  test('Sample test', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });
});
