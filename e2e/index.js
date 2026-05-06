/**
 * VS Code Extension Test Runner
 *
 * - 本地开发：优先使用系统 VS Code（macOS 可读 /Applications/...）
 * - CI（Linux）：不指定 vscodeExecutablePath，让 @vscode/test-electron 自动下载并运行
 */

const fs = require('fs');
const path = require('path');
const { runTests } = require('@vscode/test-electron');

function pickVsCodeExecutablePath() {
  const env = String(process.env.MARKLY_VSCODE_EXECUTABLE_PATH ?? '').trim();
  if (env) return env;
  if (process.platform === 'darwin') {
    return '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
  }
  return '';
}

async function main() {
  try {
    // 扩展开发路径（包含 package.json 的目录）
    const extensionDevelopmentPath = path.resolve(__dirname, '..');

    // 测试入口文件路径
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');

    const vscodeExecutablePath = pickVsCodeExecutablePath();
    const hasVsCode = vscodeExecutablePath && fs.existsSync(vscodeExecutablePath);

    console.log('Extension path:', extensionDevelopmentPath);
    console.log('Tests path:', extensionTestsPath);
    console.log('VS Code path:', hasVsCode ? vscodeExecutablePath : '(auto-download)');

    // 注意：CI 中不要传 vscodeExecutablePath，否则会因为硬编码 macOS 路径而失败。
    const args = {
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
      ...(hasVsCode ? { vscodeExecutablePath } : {}),
    };

    await runTests(args);

    console.log('Tests completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
