/**
 * VS Code Extension Test Runner
 *
 * 使用系统已安装的 VS Code 运行测试
 */

const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    // 扩展开发路径（包含 package.json 的目录）
    const extensionDevelopmentPath = path.resolve(__dirname, '..');

    // 测试入口文件路径
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');

    // 本地 VS Code CLI 路径
    const vscodeExecutablePath = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';

    console.log('Extension path:', extensionDevelopmentPath);
    console.log('Tests path:', extensionTestsPath);
    console.log('VS Code path:', vscodeExecutablePath);

    // 使用本地 VS Code 运行测试
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath,
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
