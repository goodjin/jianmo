#!/usr/bin/env node
/**
 * VS Code Extension Test Runner
 * 直接使用 Mocha 运行测试
 */

const path = require('path');
const Mocha = require('mocha');
const fs = require('fs');

async function main() {
  console.log('=== Starting VS Code Extension Tests ===\n');

  // 创建 Mocha 实例
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
  });

  const testsRoot = path.join(__dirname, 'suite');

  // 查找测试文件
  const files = fs.readdirSync(testsRoot)
    .filter(f => f.endsWith('.test.js'))
    .map(f => path.join(testsRoot, f));

  console.log('Found test files:', files);

  if (files.length === 0) {
    console.log('No test files found, skipping tests');
    process.exit(0);
  }

  // 添加测试文件
  files.forEach((f) => mocha.addFile(f));

  // 运行测试
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}

main()
  .then(() => {
    console.log('\n=== All Tests Passed ===');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n=== Tests Failed ===');
    console.error(err);
    process.exit(1);
  });
