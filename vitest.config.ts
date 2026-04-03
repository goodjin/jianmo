import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 与 webview/vite.config.ts 对齐：Vitest 独立解析依赖时若出现多份 @codemirror/*，
  // Transaction.startState 与 view.state 会不是同一模块实例，触发
  // "Trying to update state with a transaction that doesn't start from the previous state."
  resolve: {
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
      'webview/src/**/__tests__/**/*.test.ts',
      'webview/test/**/*.test.ts',
    ],
    exclude: ['e2e/**'], // e2e 目录由 Playwright 运行，不走 Vitest
  },
});
