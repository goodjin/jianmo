import { test, expect } from '@playwright/test';
import * as path from 'path';

// 这是一个纯 Webview 视角的 Playwright 冒烟测试
// 正常要测试 VS Code Extension 的全流程，需要用到类似 vscode-playwright 或者 electron 启动
// 这里我们针对刚重构的 Webview 进行独立测试，确保它能独立运行（这也是 V4 架构前后端分离的好处）

test.describe('Webview Editor Smoke Test (CM6)', () => {
  // 因为这是 Vue Webview 项目，我们可以直接访问它的 vite dev server 进行独立测试
  // 假设 Webview 服务运行在 localhost:5173
  const webviewUrl = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // 拦截 VS Code API 调用
    await page.addInitScript(() => {
      window.acquireVsCodeApi = () => ({
        postMessage: (msg: any) => console.log('Mock VS Code received:', msg),
        getState: () => ({}),
        setState: (state: any) => console.log('Mock VS Code state set:', state)
      });
    });

    await page.goto(webviewUrl);

    // 模拟 VS Code 传递 INIT 消息
    await page.evaluate(() => {
      window.postMessage({
        type: 'INIT',
        payload: {
          content: '# Test Document\n\nThis is a test document.',
          config: {
            editor: { theme: 'light', tabSize: 2 }
          }
        }
      }, '*');
    });

    // 等待编辑器挂载
    await page.waitForSelector('.cm-editor-container');
    await page.waitForSelector('.cm-content');
  });

  test('should render CodeMirror 6 with initial content', async ({ page }) => {
    // 检查编辑器容器是否存在
    await expect(page.locator('.cm-editor-container')).toBeVisible();

    // 检查初始内容是否渲染
    const editorContent = await page.locator('.cm-content').textContent();
    expect(editorContent).toContain('Test Document');
    expect(editorContent).toContain('This is a test document.');
  });

  test('should apply format when toolbar button is clicked', async ({ page }) => {
    // 点击加粗按钮
    await page.locator('.toolbar-btn[title="Bold"]').click();

    // 在 CodeMirror 中，如果没有选中文本，applyFormat 会在光标位置插入 **
    const editorContent = await page.locator('.cm-content').textContent();
    expect(editorContent).toContain('**');
  });

  test('should insert elements when insert buttons are clicked', async ({ page }) => {
    // 点击插入代码块按钮
    await page.locator('.toolbar-btn[title="Code Block"]').click();

    // 检查内容是否插入了代码块语法
    const editorContent = await page.locator('.cm-content').textContent();
    expect(editorContent).toContain('```');
    expect(editorContent).toContain('代码内容');
  });
});
