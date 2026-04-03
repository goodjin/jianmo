#!/usr/bin/env node
import { EXTEST_STORAGE } from './extest-paths.mjs';
import { spawnExtest } from './extest-spawn.mjs';

if (Number(process.versions.node.split('.')[0]) > 20) {
  console.error(
    `[extest] Node ${process.version} 下 ExTester/Selenium 常失败；请使用：npm run test:vscode:ui:setup`
  );
  process.exit(1);
}

const r = spawnExtest(['setup-tests', '-c', 'max', '-s', EXTEST_STORAGE]);
process.exit(r.status === null ? 1 : r.status);
