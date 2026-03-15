import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    environment: 'node',
    include: ['e2e/**/*.spec.ts'],
    exclude: ['e2e/complete.spec.ts'], // 排除 Playwright 测试
  },
});
