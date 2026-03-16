/**
 * VS Code Extension Test Runner
 *
 * 使用 @vscode/test-electron 运行测试
 * 详细说明见: https://code.visualstudio.com/api/working-with-extensions/testing-extension
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // 扩展开发路径（包含 package.json 的目录）
    const extensionDevelopmentPath = path.resolve(__dirname, '..');

    // 测试入口文件路径
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');

    // 下载并运行 VS Code 实例进行测试
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
    });

    console.log('Tests completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
