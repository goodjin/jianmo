import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extestCli = path.join(root, 'node_modules', 'vscode-extension-tester', 'out', 'cli.js');

/**
 * vscode-extension-tester 仅官方测试 Node 20；用当前 execPath 调用 CLI，避免 `npx` 绑到其它 Node。
 * @param {string[]} argv 传给 extest 的参数（不含 `extest` 本身）
 * @param {{ timeoutMs?: number }} [opts] 可选：spawnSync 超时（用于防止 install-vsix 卡死无输出）
 */
export function spawnExtest(argv, opts = {}) {
  const { timeoutMs } = opts || {};
  return spawnSync(process.execPath, [extestCli, ...argv], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
    timeout: typeof timeoutMs === 'number' ? timeoutMs : undefined,
    killSignal: 'SIGKILL',
  });
}
