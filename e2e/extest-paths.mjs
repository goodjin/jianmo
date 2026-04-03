import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** ExTester 资源根目录（VS Code、chromedriver、测试期 user-data-dir 均在此下） */
export const EXTEST_STORAGE = path.join(root, '.vscode-test', 'extest-ui');

export const EXTEST_FIXTURE = path.join(root, 'e2e/ui-suite/fixture-workspace');
export const EXTEST_MOCHARC = path.join(root, '.mocharc.vscode-ui.json');
export const EXTEST_TEST_GLOB = path.join(root, 'e2e/ui-suite/**/*.test.js');
