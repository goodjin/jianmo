#!/usr/bin/env node
/**
 * 与 playwright.config.ts 一致：默认把浏览器装到项目内（PLAYWRIGHT_BROWSERS_PATH=0）
 */
import { spawnSync } from 'node:child_process';

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

const r = spawnSync('npx', ['playwright', 'install', 'chromium'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
