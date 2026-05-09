#!/usr/bin/env node
/**
 * 手工验证入口：用“和 UI E2E 类似的方式”启动 VS Code（Extension Development Host），
 * 打开 e2e fixture workspace，并定位到手工验收文档。
 *
 * 特点：
 * - 不会自动关闭 VS Code：由用户手动关闭窗口即可。
 * - 复用 e2e/vscode-ui-launch.mjs 同款启动参数（skip welcome / disable telemetry 等）。
 */
import path from 'node:path';
import fs from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildManualFixtureMarkdown } from './manual-fixture-content.mjs';
import { ensureFixtureSamplePngs } from './write-fixture-sample-pngs.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_WORKSPACE = path.join(REPO_ROOT, 'e2e', 'ui-suite', 'fixture-workspace');
const FIXTURE_ASSETS = path.join(FIXTURE_WORKSPACE, 'assets');
const MANUAL_MD = path.join(FIXTURE_WORKSPACE, 'manual-rich.md');

const vscodeCli =
  (process.env.VSCODE_CLI_PATH &&
    existsSync(process.env.VSCODE_CLI_PATH) &&
    process.env.VSCODE_CLI_PATH) ||
  (existsSync('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')
    ? '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    : 'code');

function main() {
  // 启动前确保手工验收文档存在且最新（启动时自动打开它）
  try {
    fs.mkdirSync(FIXTURE_WORKSPACE, { recursive: true });
    ensureFixtureSamplePngs(FIXTURE_ASSETS);
    fs.writeFileSync(MANUAL_MD, buildManualFixtureMarkdown(), 'utf8');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Markly] 写入手工验收文档失败（将继续启动 VS Code）：', e);
  }

  // 关键：隔离 user-data / extensions，避免加载你本机已安装的旧版扩展（例如 1.5.4）
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-manual-ui-'));
  const userDataDir = path.join(tmpBase, 'user-data');
  const extensionsDir = path.join(tmpBase, 'extensions');
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(extensionsDir, { recursive: true });
  } catch {
    // ignore
  }

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
    FIXTURE_WORKSPACE,
  ];

  // 启动时自动打开验收文档
  if (existsSync(MANUAL_MD)) args.push(MANUAL_MD);

  // 不 await、不 exit：让 VS Code 常驻
  spawn(vscodeCli, args, { stdio: 'inherit', env: process.env });

  // eslint-disable-next-line no-console
  console.log('[Markly] VS Code 已启动（不会自动关闭）。请在 VS Code 中手动关闭窗口结束手工测试。');
  // eslint-disable-next-line no-console
  console.log(`[Markly] workspace: ${FIXTURE_WORKSPACE}`);
  // eslint-disable-next-line no-console
  console.log(`[Markly] manual doc: ${MANUAL_MD}`);
  // eslint-disable-next-line no-console
  console.log(`[Markly] isolated user-data-dir: ${userDataDir}`);
  // eslint-disable-next-line no-console
  console.log(`[Markly] isolated extensions-dir: ${extensionsDir}`);
}

main();

