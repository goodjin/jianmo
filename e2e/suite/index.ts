/**
 * VS Code Extension Test Suite
 *
 * 使用 Mocha 运行测试
 * 详细说明见: https://code.visualstudio.com/api/working-with-extensions/testing-extension
 */

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  // 创建 Mocha 实例
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // 查找所有测试文件
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }

      // 添加测试文件到 Mocha
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // 运行测试
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}
