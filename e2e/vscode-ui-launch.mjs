#!/usr/bin/env node
/**
 * 本地偶尔用的「真实 VS Code UI」验证入口（手工验证）：
 * - 启动 Extension Development Host
 * - 打开临时工作区里的 sample.md
 *
 * 说明：
 * - 目前 VS Code Webview 内容难以稳定用 Playwright/CDP 自动化穿透（版本差异大）
 * - 因此这里用“启动到可点击的真实 UI”为主，让你手工点两下确认链路 OK
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname, '..');
const vscodeCli =
  (process.env.VSCODE_CLI_PATH &&
    existsSync(process.env.VSCODE_CLI_PATH) &&
    process.env.VSCODE_CLI_PATH) ||
  (existsSync('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')
    ? '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    : 'code');

async function main() {
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'markly-vscode-ui-'));
  const userDataDir = path.join(tmpBase, 'user-data');
  const extensionsDir = path.join(tmpBase, 'extensions');
  const workspaceDir = path.join(tmpBase, 'workspace');
  await fs.mkdir(userDataDir, { recursive: true });
  await fs.mkdir(extensionsDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });

  const mdPath = path.join(workspaceDir, 'sample.md');
  await fs.writeFile(
    mdPath,
    ['# Title', '', 'alpha beta', '', '$x^2$', '', '```mermaid', 'flowchart TD', 'A-->B', '```', ''].join('\n'),
    'utf8'
  );

  const args = [
    '--new-window',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates',
    '--disable-telemetry',
    '--locale',
    'en',
    '--user-data-dir',
    userDataDir,
    '--extensions-dir',
    extensionsDir,
    '--extensionDevelopmentPath',
    REPO_ROOT,
    workspaceDir,
  ];

  spawn(vscodeCli, args, { stdio: 'inherit', env: process.env });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

