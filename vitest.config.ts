import path from 'node:path';
import { defineConfig } from 'vitest/config';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  // 与 webview/vite.config.ts 对齐：Vitest 独立解析依赖时若出现多份 @codemirror/*，
  // Transaction.startState 与 view.state 会不是同一模块实例，触发
  // "Trying to update state with a transaction that doesn't start from the previous state."
  resolve: {
    alias: {
      '@core': r('src/core'),
      '@types': r('src/types'),
      '@extension': r('src/extension'),
      '@editor': r('src/editor'),
      '@plugins': r('src/plugins'),
      '@image': r('src/image'),
      '@services': r('src/services'),
    },
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/lang-markdown',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/markdown',
    ],
  },
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    environment: 'node',
    setupFiles: ['webview/src/test/codemirrorDomSetup.ts'],
    include: [
      'src/**/__tests__/**/*.test.ts',
    ],
    exclude: ['e2e/**'], // e2e 为 VS Code / ExTester 脚本与 UI 套件，不走 Vitest
  },
});
