import { test, expect, type Page } from '@playwright/test';

const WEBVIEW_URL = 'http://localhost:5173';

async function installVsCodeBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let acquired = false;
    (window as any).__vscodeMessages = [];
    (window as any).__promptMessages = [];
    (window as any).__promptQueue = [];

    // 在 Playwright 环境里用 stub prompt，避免原生 dialog 的不稳定性
    window.prompt = (message?: string, defaultValue?: string) => {
      (window as any).__promptMessages.push(String(message ?? ''));
      const q: any[] = (window as any).__promptQueue || [];
      if (q.length > 0) return q.shift();
      return defaultValue ?? null;
    };

    window.acquireVsCodeApi = () => {
      if (acquired) {
        throw new Error('acquireVsCodeApi can only be called once');
      }
      acquired = true;

      const api = {
        postMessage: (msg: any) => {
          (window as any).__vscodeMessages.push(msg);
          // 模拟宿主：收到 READY 后回送 INIT
          if (msg?.type === 'READY') {
            setTimeout(() => {
              window.postMessage(
                {
                  type: 'INIT',
                  payload: {
                    content: '',
                    config: {
                      editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
                      image: {
                        saveDirectory: './assets',
                        compressThreshold: 512000,
                        compressQuality: 0.8,
                      },
                      export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
                    },
                    version: 1,
                  },
                },
                '*'
              );
            }, 50);
          }
        },
        getState: () => ({}),
        setState: () => {},
      };

      (window as any).vscode = api;
      return api;
    };
  });
}

async function getE2EDoc(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__marklyE2E?.getContent?.() ?? '');
}

test.describe('Webview Editor Comprehensive E2E Tests（合规可执行）', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeBridge(page);
    await page.goto(WEBVIEW_URL);
    await page.waitForSelector('.toolbar');
    await page.waitForSelector('.cm-editor');
  });

  test('applyFormat: inline marks + h2 + list prefixes', async ({ page }) => {
    // italic
    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.locator('.cm-content').click();
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('italic'));
    await page.keyboard.type('x');
    expect(await getE2EDoc(page)).toBe('*x*');

    // strike
    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.locator('.cm-content').click();
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('strike'));
    await page.keyboard.type('x');
    expect(await getE2EDoc(page)).toBe('~~x~~');

    // heading h2
    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('h2'));
    expect(await getE2EDoc(page)).toBe('## ');

    // list prefixes
    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('bulletList'));
    expect(await getE2EDoc(page)).toBe('- ');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('orderedList'));
    expect(await getE2EDoc(page)).toBe('1. ');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('taskList'));
    expect(await getE2EDoc(page)).toBe('- [ ] ');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.applyFormat?.('quote'));
    expect(await getE2EDoc(page)).toBe('> ');
  });

  test('insert: table/codeBlock/math/hr/image', async ({ page }) => {
    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));

    await page.evaluate(() => (window as any).__marklyE2E?.insertNode?.('table'));
    expect(await getE2EDoc(page)).toContain('| 列1 | 列2 | 列3 |');
    expect(await getE2EDoc(page)).toContain('|-----|-----|-----|');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.insertNode?.('codeBlock'));
    expect(await getE2EDoc(page)).toContain('```');
    expect(await getE2EDoc(page)).toContain('代码内容');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.insertNode?.('math'));
    expect(await getE2EDoc(page)).toContain('$$');
    expect(await getE2EDoc(page)).toContain('E = mc^2');

    await page.evaluate(() => (window as any).__marklyE2E?.setContent?.(''));
    await page.evaluate(() => (window as any).__marklyE2E?.insertNode?.('hr'));
    expect(await getE2EDoc(page)).toContain('---');

    // image 需要 prompt 队列：先返回 alt，再返回 url
    await page.evaluate(() => {
      (window as any).__promptQueue = ['截图', 'https://img.com/a.png'];
      (window as any).__marklyE2E?.setContent?.('');
    });
    await page.evaluate(() => (window as any).__marklyE2E?.insertNode?.('image'));
    expect(await getE2EDoc(page)).toBe('![截图](https://img.com/a.png)');
  });

  test('初始化握手：INIT 延迟到达后仍应创建编辑器并停止 READY 重试', async ({ page }) => {
    const freshPage = await page.context().newPage();

    let readyMessageCount = 0;
    await freshPage.addInitScript(() => {
      window.acquireVsCodeApi = () => {
        const api = {
          postMessage: (msg: any) => {
            if (msg.type === 'READY') {
              (window as any).readyMessageCount = ((window as any).readyMessageCount || 0) + 1;
            }
          },
          getState: () => ({}),
          setState: () => {},
        };
        // useVSCode 依赖 window.vscode
        (window as any).vscode = api;
        return api;
      };
      // stub prompt，防止其它流程意外触发
      (window as any).prompt = () => null;
    });

    await freshPage.goto(WEBVIEW_URL);
    // editorReady=false 时 toolbar 不会出现，等待根节点即可
    await freshPage.waitForSelector('.md-editor-app');

    await freshPage.waitForTimeout(3200);
    const count = await freshPage.evaluate(() => (window as any).readyMessageCount);
    expect(count).toBeGreaterThanOrEqual(2);

    // 现在补发 INIT
    await freshPage.evaluate(() => {
      window.postMessage(
        {
          type: 'INIT',
          payload: { content: 'handshake', config: { editor: { theme: 'light' } }, version: 1 },
        },
        '*'
      );
    });

    await freshPage.waitForSelector('.cm-editor');
    await freshPage.waitForTimeout(2000);
    const finalCount = await freshPage.evaluate(() => (window as any).readyMessageCount);
    expect(finalCount).toBe(count);

    await freshPage.close();
    void readyMessageCount;
  });
});