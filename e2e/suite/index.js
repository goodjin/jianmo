/**
 * VS Code Extension Test Suite
 */

const path = require('path');
const Mocha = require('mocha');
const fs = require('fs');

/**
 * 运行测试
 * @param {string} testsRoot - 测试根目录
 * @returns {Promise<void>}
 */
function run(testsRoot) {
  console.log('[Test Suite] run() called with testsRoot:', testsRoot);

  // 创建 Mocha 实例
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
  });

  return new Promise((resolve, reject) => {
    try {
      // 查找测试文件
      const files = fs.readdirSync(testsRoot)
        .filter(f => f.endsWith('.test.js'))
        .map(f => path.join(testsRoot, f));

      console.log('[Test Suite] Found test files:', files);

      if (files.length === 0) {
        console.log('[Test Suite] No test files found');
        resolve();
        return;
      }

      // 添加测试文件
      files.forEach((f) => mocha.addFile(f));

      // 运行测试
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error('[Test Suite] Error:', err);
      reject(err);
    }
  });
}

module.exports = { run };
