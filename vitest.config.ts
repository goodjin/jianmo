import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    environment: 'node',
    include: ['src/extension/__tests__/**/*.test.ts', 'webview/src/**/__tests__/**/*.test.ts'],
    exclude: ['e2e/**'], // e2e 目录由 Playwright 运行，不走 Vitest
  },
});
