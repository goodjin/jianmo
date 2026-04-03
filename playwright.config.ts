import { defineConfig, devices } from '@playwright/test';

// 始终使用项目内浏览器目录（node_modules 下），避免沙箱/CI 把 PLAYWRIGHT_BROWSERS_PATH
// 指到空目录导致 “Executable doesn't exist”；与 `npm run test:e2e:install` 一致
process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

/**
 * VS Code Extension E2E Test Configuration
 */
export default defineConfig({
  testDir: './e2e',
  // 只运行 Playwright spec，避免把 VS Code mocha suite（*.test.ts）当成 Playwright 用例加载
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:webview',
    url: 'http://localhost:5173',
    // 本地与 CI 都允许复用已有 dev server，避免端口占用导致 e2e 直接失败
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
