#!/usr/bin/env node
/**
 * 以绝对路径调用 extest，避免 `-r` 工作区目录在不同 shell 下解析不一致
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTEST_FIXTURE, EXTEST_MOCHARC, EXTEST_STORAGE, EXTEST_TEST_GLOB } from './extest-paths.mjs';
import { spawnExtest } from './extest-spawn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function cleanupLegacyElectronBackupOnMac() {
  if (process.platform !== 'darwin') return;
  const storageApp = path.join(EXTEST_STORAGE, 'Visual Studio Code.app');
  if (!fs.existsSync(storageApp)) return;

  const macosDir = path.join(storageApp, 'Contents', 'MacOS');
  const electronPath = path.join(macosDir, 'Electron');
  const backupPath = path.join(macosDir, 'Electron.extest-backup');
  if (!fs.existsSync(backupPath) || !fs.existsSync(electronPath)) return;

  // 旧实现曾尝试把 Electron 入口替换成 wrapper 脚本（open -n --args + 常驻）。
  // 现在已不再使用该方案；若检测到 Electron 被替换为脚本，则恢复并删除 backup，避免反复影响后续跑。
  try {
    const buf = fs.readFileSync(electronPath, { encoding: null });
    const head = buf.subarray(0, 2).toString('utf8');
    if (head === '#!') {
      fs.copyFileSync(backupPath, electronPath);
      fs.chmodSync(electronPath, 0o755);
    }
    fs.rmSync(backupPath, { force: true });
  } catch {
    // ignore
  }
}

if (process.platform === 'darwin' && process.env.SSH_CONNECTION) {
  console.warn(
    '[extest] 当前为 SSH 会话：若无登录用户的图形界面（WindowServer），VS Code / Electron 常会立刻退出；请在 Mac 本机「终端.app」或带桌面的会话里执行 npm run test:vscode:ui。'
  );
}

if (Number(process.versions.node.split('.')[0]) > 20) {
  console.error(
    `[extest] Node ${process.version} 下 ExTester/Selenium 常失败；请使用：npm run test:vscode:ui`
  );
  process.exit(1);
}

// 清理测试用 user-data-dir，避免上次异常退出后 SingletonLock / 残留 Electron 进程导致 SessionNotCreatedError
const extestSettings = path.join(EXTEST_STORAGE, 'settings');
const extestExtensionsDir = path.join(EXTEST_STORAGE, 'extensions');

function killProcessesMatchingCommand(pattern) {
  if (process.platform === 'win32') return;
  try {
    spawnSync('pkill', ['-f', pattern], { stdio: 'ignore' });
  } catch {
    // ignore
  }
}

// 结束残留进程（常见于上次 Ctrl+C / crash，导致 ChromeDriver 启动失败或崩溃）
// 注意：这些匹配尽量限定在 extest storage 下，避免误杀你本机其他 VS Code。
const cleanupPatterns = [
  extestSettings,
  EXTEST_STORAGE,
  path.join(EXTEST_STORAGE, 'chromedriver'),
  'chromedriver',
  'extest-code',
];

for (const pattern of cleanupPatterns) {
  // eslint-disable-next-line no-await-in-loop
  killProcessesMatchingCommand(pattern);
}
if (process.platform !== 'win32') {
  spawnSync('sleep', ['1'], { stdio: 'ignore' });
}

try {
  fs.rmSync(extestSettings, { recursive: true, force: true });
} catch {
  // ignore
}

// 隔离 extensions_dir，避免加载你本机已有的第三方扩展（会注入额外 webview/iframe，导致 UI 测试被拦截）
try {
  fs.rmSync(extestExtensionsDir, { recursive: true, force: true });
  fs.mkdirSync(extestExtensionsDir, { recursive: true });
} catch {
  // ignore
}

cleanupLegacyElectronBackupOnMac();

// ExTester 的 run-tests 不会自动重装扩展：测试 VS Code 里仍是「上次 setup-tests 安装的 vsix」。
// 若只改了 webview/extension 却没重新 setup，会出现 webview 一直 Loading / 找不到 .toolbar。
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vsixFile = path.join(root, `${pkg.name}-${pkg.version}.vsix`);
console.log('[extest] vsce package + install-vsix（每次用当前构建覆盖测试实例中的扩展）');
let pr = spawnSync('npm', ['run', 'package', '--', '--allow-missing-repository'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
if (pr.status === null) process.exit(1);
if (pr.status !== 0) process.exit(pr.status);
if (!fs.existsSync(vsixFile)) {
  console.error(`[extest] 未找到 ${vsixFile}，vsce package 可能未生成预期文件名`);
  process.exit(1);
}
pr = spawnExtest(['install-vsix', '-s', EXTEST_STORAGE, '-e', extestExtensionsDir, '-f', vsixFile]);
if (pr.status === null) process.exit(1);
if (pr.status !== 0) process.exit(pr.status);

// 与 vscode-extension-tester 声明的 supported vscode-max 对齐；`-s` 必须与 `setup-extest-ui.mjs` 一致（内含 chromedriver）
const args = [
  'run-tests',
  '-c',
  'max',
  '-s',
  EXTEST_STORAGE,
  '-e',
  extestExtensionsDir,
  '-r',
  EXTEST_FIXTURE,
  '-m',
  EXTEST_MOCHARC,
  EXTEST_TEST_GLOB,
];
const r = spawnExtest(args);
// 无论成功/失败都做一次兜底清理，避免残留 VS Code/ChromeDriver 影响下一次跑（以及你看到的“反复启动”）
for (const pattern of cleanupPatterns) {
  // eslint-disable-next-line no-await-in-loop
  killProcessesMatchingCommand(pattern);
}
process.exit(r.status === null ? 1 : r.status);
