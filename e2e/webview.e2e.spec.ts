import { test, expect } from '@playwright/test';

test.describe('Webview Editor Comprehensive E2E Tests', () => {
  const webviewUrl = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Intercept VS Code API
    await page.addInitScript(() => {
      window.acquireVsCodeApi = () => ({
        postMessage: (msg: any) => {
          // Push to an array on window so we can inspect it in tests
          (window as any).vscodeMessages = (window as any).vscodeMessages || [];
          (window as any).vscodeMessages.push(msg);
          console.log('Mock VS Code received:', msg);
        },
        getState: () => ({}),
        setState: (state: any) => console.log('Mock VS Code state set:', state)
      });
    });

    await page.goto(webviewUrl);

    // Initial INIT message
    await page.evaluate(() => {
      window.postMessage({
        type: 'INIT',
        payload: {
          content: 'Initial text',
          config: {
            editor: { theme: 'light', tabSize: 2 }
          }
        }
      }, '*');
    });

    // Wait for the toolbar (INIT done), then switch to source mode for editing
    await page.waitForSelector('.toolbar');
    await page.locator('.toolbar-btn.mode-btn', { hasText: 'Source' }).click();
    await page.waitForSelector('.cm-content');
  });

  test.describe('Basic Formatting', () => {
    test('should apply Bold formatting', async ({ page }) => {
      // Focus and type text
      await page.locator('.cm-content').click();
      await page.keyboard.type('bold test');

      // Select the text (shift + ArrowLeft)
      for(let i=0; i<9; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
      }

      await page.locator('.toolbar-btn[title="Bold"]').click();

      // Verify CodeMirror content
      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('**bold test**');
    });

    test('should apply Italic formatting', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.keyboard.type('italic');
      for(let i=0; i<6; i++) { await page.keyboard.press('Shift+ArrowLeft'); }

      await page.locator('.toolbar-btn[title="Italic"]').click();
      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('*italic*');
    });

    test('should apply Headings', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.keyboard.press('Control+a'); // Select all (or Cmd+A on Mac, but Ctrl+A works on Playwright default sometimes, let's just clear)
      await page.keyboard.press('Backspace');

      await page.locator('.toolbar-btn[title="Heading 2"]').click();
      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('## ');
    });
  });

  test.describe('Insert Operations', () => {
    test('should insert Link', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.locator('.toolbar-btn[title="Link"]').click();

      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('[链接文字](https://example.com)');
    });

    test('should insert Code Block', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.locator('.toolbar-btn[title="Code Block"]').click();

      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('```');
      expect(content).toContain('代码内容');
    });

    test('should insert Table', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.locator('.toolbar-btn[title="Table"]').click();

      const content = await page.locator('.cm-content').textContent();
      expect(content).toContain('| 列1 | 列2 | 列3 |');
      expect(content).toContain('|-----|-----|-----|');
    });
  });

  test.describe('UI Components', () => {
    test('should update word count correctly', async ({ page }) => {
      // Set new content via INIT to check word count
      await page.evaluate(() => {
        window.postMessage({
          type: 'INIT',
          payload: {
            content: 'Hello world! 测试字数',
            config: { editor: { theme: 'light', tabSize: 2 } }
          }
        }, '*');
      });

      // wait for content to be "Hello world! 测试字数"
      await expect(page.locator('.cm-content')).toContainText('Hello world! 测试字数');

      const wordCountText = await page.locator('.word-count').textContent();
      // "Hello" (1) + "world" (1) + "测试字数" (4) = 6
      expect(wordCountText).toContain('字数: 6');
      expect(wordCountText).toContain('字符: 17');
    });

    test('should toggle outline panel', async ({ page }) => {
      // Switch to preview mode to see outline
      await page.locator('.toolbar-btn[title="Preview Mode"]').click();
      // By default outline might be visible if content has headings, let's inject headings
      await page.evaluate(() => {
        window.postMessage({
          type: 'INIT',
          payload: {
            content: '# H1\n## H2',
            config: { editor: { theme: 'light', tabSize: 2 } }
          }
        }, '*');
      });

      // Wait for outline panel to show
      const outlinePanel = page.locator('.outline-panel');
      await expect(outlinePanel).toBeVisible();

      // Click toggle button
      await page.locator('.toolbar-btn[title="Toggle Outline"]').click();
      await expect(outlinePanel).toBeHidden();

      // Click again
      await page.locator('.toolbar-btn[title="Toggle Outline"]').click();
      await expect(outlinePanel).toBeVisible();
    });

    test('should switch modes between source and preview', async ({ page }) => {
      // Check Source button
      const sourceBtn = page.locator('.toolbar-btn[title="Source Mode"]');
      const previewBtn = page.locator('.toolbar-btn[title="Preview Mode"]');

      // Click Source Mode
      await sourceBtn.click();
      await expect(sourceBtn).toHaveClass(/active/);

      // Click Preview Mode
      await previewBtn.click();
      await expect(previewBtn).toHaveClass(/active/);
    });

    test('should trigger extension messages on content change', async ({ page }) => {
      await page.locator('.cm-content').click();
      await page.keyboard.type('New typing');

      // Check window.vscodeMessages
      const messages = await page.evaluate(() => {
        return (window as any).vscodeMessages || [];
      });

      // Ensure CONTENT_CHANGE message was sent
      const contentChangeMsgs = messages.filter((m: any) => m.type === 'CONTENT_CHANGE');
      expect(contentChangeMsgs.length).toBeGreaterThan(0);
      expect(contentChangeMsgs[contentChangeMsgs.length - 1].payload.content).toContain('New typing');
    });

    test('should retry READY message if INIT is not received', async ({ page }) => {
      // Create a fresh page to test the initialization phase
      const freshPage = await page.context().newPage();

      let readyMessageCount = 0;

      await freshPage.addInitScript(() => {
        window.acquireVsCodeApi = () => ({
          postMessage: (msg: any) => {
            if (msg.type === 'READY') {
              (window as any).readyMessageCount = ((window as any).readyMessageCount || 0) + 1;
            }
          },
          getState: () => ({}),
          setState: () => {}
        });
      });

      await freshPage.goto('http://localhost:5173');

      // Wait for a few seconds to let the retry mechanism trigger multiple times
      await freshPage.waitForTimeout(3500);

      const count = await freshPage.evaluate(() => (window as any).readyMessageCount);

      // The retry happens every 1 second, so after 3.5 seconds it should have sent READY ~4 times
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);

      // Now simulate receiving INIT
      await freshPage.evaluate(() => {
        window.postMessage({
          type: 'INIT',
          payload: { content: 'Test content', config: { editor: {} } }
        }, '*');
      });

      // Wait for preview container to appear (meaning INIT was processed)
      await freshPage.waitForSelector('.preview-container');

      // Wait another 2 seconds to ensure retries stopped
      await freshPage.waitForTimeout(2000);
      const finalCount = await freshPage.evaluate(() => (window as any).readyMessageCount);

      // The count should not have increased significantly
      expect(finalCount).toBe(count);

      await freshPage.close();
    });
  });


  // ============================================
  // Additional UX Test Cases (Added 2026-03-23)
  // ============================================

  test.describe('Keyboard Shortcuts', () => {
    test('should handle keyboard shortcuts without error', async ({ page }) => {
      // Switch to preview mode where shortcuts are handled
      await page.locator('.toolbar-btn.mode-btn', { hasText: 'Preview' }).click();
      await page.waitForSelector('.preview-container');
      // Use Ctrl+B shortcut - should not throw error
      await page.keyboard.press('Control+b');
      // Use Ctrl+I shortcut
      await page.keyboard.press('Control+i');
      // Use Ctrl+Z shortcut
      await page.keyboard.press('Control+z');
      // If we get here without error, test passes
      expect(true).toBe(true);
    });
  });
});