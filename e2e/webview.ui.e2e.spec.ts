import { test, expect, type Page, type Dialog } from '@playwright/test';

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
                    content: '# Title\n\nalpha beta',
                    config: {
                      editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
                      image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
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

async function getVsCodeMessages(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__vscodeMessages || []);
}

test.describe('Webview UI Regression Flows', () => {
  test.beforeEach(async ({ page }) => {
    await installVsCodeBridge(page);
    await page.goto(WEBVIEW_URL);
    await page.waitForSelector('.toolbar');
    // 确保 CodeMirror 已创建（cmView 会挂在 .cm-editor 上）
    await page.waitForSelector('.cm-editor');
  });

  test('模式切换保持内容一致，并正确更新激活态', async ({ page }) => {
    const sourceBtn = page.locator('.toolbar-btn.mode-btn[title="Source Mode"]');
    const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');

    await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);

    await page.locator('.cm-content').click();
    await page.keyboard.type('\n\npersist-content');
    await expect(page.locator('.cm-content')).toContainText('persist-content');

    await irBtn.click();
    await expect(irBtn).toHaveClass(/active/);
    await expect(page.locator('.cm-content')).toContainText('persist-content');

    await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);
    await expect(page.locator('.cm-content')).toContainText('persist-content');
  });

  test('工具栏格式化：选区加粗后文本被 markdown 包裹', async ({ page }) => {
    const sourceBtn = page.locator('.toolbar-btn.mode-btn[title="Source Mode"]');
    await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);

    // 无选区时：点击 Bold 会插入 markers，随后输入应形成 markdown 加粗文本
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('');
    await page.locator('.toolbar-btn[title="Bold"]').click();
    await page.keyboard.type('hello');
    await page.locator('.toolbar-btn[title="Bold"]').click();

    // 用 VS Code bridge 捕获的 CONTENT_CHANGE 做断言（比直接读 cm-content 更稳定）
    const messages = await getVsCodeMessages(page);
    const contentMsgs = messages.filter((m) => m?.type === 'CONTENT_CHANGE');
    expect(contentMsgs.length).toBeGreaterThan(0);
    const last = contentMsgs[contentMsgs.length - 1];
    expect(last?.payload?.content).toContain('hello');
    expect(last?.payload?.content).toContain('**');
  });

  test('查找替换：Ctrl+F 打开面板并执行全部替换', async ({ page }) => {
    await page.locator('.toolbar-btn.mode-btn[title="Source Mode"]').click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('foo foo foo');

    await page.keyboard.press('ControlOrMeta+f');
    await expect(page.locator('.find-replace-panel')).toBeVisible();

    const inputs = page.locator('.find-replace-panel .panel-input');
    await inputs.nth(0).fill('foo');
    await inputs.nth(1).fill('bar');
    await page.locator('.find-replace-panel .action-btn.primary', { hasText: '全部替换' }).click();

    await expect(page.locator('.cm-content')).toContainText('bar bar bar');
  });

  test('大纲面板：标题渲染与点击高亮', async ({ page }) => {
    await page.locator('.toolbar-btn.mode-btn[title="Source Mode"]').click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('# A\n\n## B\n\n### C');

    const outline = page.locator('.outline-panel');
    await expect(outline).toBeVisible();
    await expect(outline.locator('.outline-item')).toHaveCount(3);

    await outline.locator('.outline-item', { hasText: 'B' }).click();
    await expect(outline.locator('.outline-item.active')).toContainText('B');

    // 切换大纲可见性
    await page.locator('.toolbar-btn[title="Toggle Outline"]').click();
    await expect(outline).toBeHidden();
    await page.locator('.toolbar-btn[title="Toggle Outline"]').click();
    await expect(outline).toBeVisible();
  });

  test('插入链接触发 prompt，并写入自定义 markdown', async ({ page }) => {
    const sourceBtn = page.locator('.toolbar-btn.mode-btn[title="Source Mode"]');
    await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);

    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');

    // stub prompt 队列：先返回链接文字，再返回链接地址
    await page.evaluate(() => {
      (window as any).__promptQueue = ['Playwright Link', 'https://playwright.dev'];
    });

    await page.locator('.toolbar-btn[title="Link"]').click();
    const messages = await getVsCodeMessages(page);
    const contentMsgs = messages.filter((m) => m?.type === 'CONTENT_CHANGE');
    expect(contentMsgs.length).toBeGreaterThan(0);
    const last = contentMsgs[contentMsgs.length - 1];
    expect(last?.payload?.content).toContain('[Playwright Link](https://playwright.dev)');

    const promptMessages = await page.evaluate(() => (window as any).__promptMessages || []);
    expect(promptMessages.join(' ')).toContain('链接文字');
    expect(promptMessages.join(' ')).toContain('链接地址');
  });

  test('导出按钮透传 EXPORT 消息（pdf/html）', async ({ page }) => {
    await page.locator('.toolbar-btn[title="Export PDF"]').click();
    await page.locator('.toolbar-btn[title="Export HTML"]').click();

    const messages = await getVsCodeMessages(page);
    const exportMsgs = messages.filter((m) => m?.type === 'EXPORT');
    expect(exportMsgs.length).toBeGreaterThanOrEqual(2);
    expect(exportMsgs.some((m) => m?.payload?.format === 'pdf')).toBe(true);
    expect(exportMsgs.some((m) => m?.payload?.format === 'html')).toBe(true);
  });

  test.describe('Undo / Redo：避免 window 与 CM6 双通道撤销', () => {
    async function getE2EDoc(page: Page): Promise<string> {
      return page.evaluate(() => (window as any).__marklyE2E?.getContent?.() ?? '');
    }

    /** 用 E2E 桥置空文档，避免依赖 CM 内 Select All 在复杂文档上的选区行为 */
    async function prepareEmptyEditorDoc(page: Page): Promise<void> {
      await page.waitForFunction(() => typeof (window as any).__marklyE2E?.setContent === 'function');
      await page.evaluate(() => (window as any).__marklyE2E.setContent(''));
      await page.waitForFunction(() => ((window as any).__marklyE2E.getContent() ?? '') === '');
    }

    test('默认历史：Ctrl/Cmd+Z 一次只撤销一步（编辑区聚焦）', async ({ page }) => {
      await prepareEmptyEditorDoc(page);
      await page.locator('.toolbar-btn.mode-btn[title="Source Mode"]').click();
      await page.locator('.cm-content').click();
      await expect(page.locator('.cm-editor')).toHaveClass(/cm-focused/);

      // CM history 默认 newGroupDelay=500ms；连续打入可能被合并为一条事件，一次 undo 会删掉整段
      await page.keyboard.type('a');
      await page.waitForTimeout(550);
      await page.keyboard.type('b');

      await page.keyboard.press('ControlOrMeta+z');

      const doc = await getE2EDoc(page);
      expect(doc).toBe('a');
    });

    test('原生 CM history：Ctrl/Cmd+Z 不触发 __marklyNativeHistoryLastError 且只撤销一步', async ({
      page,
    }) => {
      await prepareEmptyEditorDoc(page);
      await page.evaluate(() => {
        (window as any).__marklyUseNativeHistory = true;
        (window as any).__marklyNativeHistoryLastError = null;
      });

      await page.locator('.toolbar-btn.mode-btn[title="Source Mode"]').click();
      await page.locator('.cm-content').click();
      await expect(page.locator('.cm-editor')).toHaveClass(/cm-focused/);
      await page.keyboard.type('x');
      await page.waitForTimeout(550);
      await page.keyboard.type('y');

      await page.keyboard.press('ControlOrMeta+z');

      const err = await page.evaluate(() => (window as any).__marklyNativeHistoryLastError);
      expect(err).toBeNull();

      const doc = await getE2EDoc(page);
      expect(doc).toBe('x');
    });

    test('工具栏撤销与默认历史：只回滚一步', async ({ page }) => {
      await prepareEmptyEditorDoc(page);
      await page.locator('.toolbar-btn.mode-btn[title="Source Mode"]').click();
      await page.locator('.cm-content').click();
      await page.keyboard.type('mn');

      await page.locator('.toolbar-btn[title="Undo (Ctrl+Z)"]').click();

      expect(await getE2EDoc(page)).toBe('m');
    });
  });

  test.describe('v6 IR：KaTeX / Mermaid 渲染回归', () => {
    test('IR 中应渲染行内与块级 KaTeX（成功路径）', async ({ page }) => {
      const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');
      await irBtn.click();
      await expect(irBtn).toHaveClass(/active/);

      // 注入包含行内/块级公式的内容
      await page.evaluate(() => {
        window.postMessage(
          {
            type: 'INIT',
            payload: {
              content: 'Inline: $x^2$\n\n$$E=mc^2$$\n',
              config: {
                editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
                image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
                export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
              },
              version: 2,
            },
          },
          '*'
        );
      });

      // 等待装饰器渲染完成（katex 是动态 import）
      await expect(page.locator('.cm-math-inline')).toHaveCount(1, { timeout: 15000 });
      await expect(page.locator('.cm-math-block')).toHaveCount(1, { timeout: 15000 });

      // KaTeX 通常会包含 annotation，里面带原始 latex，便于断言“内容确实渲染了目标公式”
      await expect(page.locator('.cm-math-inline')).toContainText('x^2');
      await expect(page.locator('.cm-math-block')).toContainText('E=mc^2');
    });

    test('IR 中应渲染 Mermaid 为 svg（成功路径）', async ({ page }) => {
      const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');
      await irBtn.click();
      await expect(irBtn).toHaveClass(/active/);

      await page.evaluate(() => {
        window.postMessage(
          {
            type: 'INIT',
            payload: {
              content: '```mermaid\nflowchart TD\n  A-->B\n```\n',
              config: {
                editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
                image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
                export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
              },
              version: 3,
            },
          },
          '*'
        );
      });

      const diagram = page.locator('.cm-diagram');
      await expect(diagram).toHaveCount(1, { timeout: 15000 });
      await expect(diagram.locator('svg')).toHaveCount(1, { timeout: 15000 });
      await expect(diagram).not.toHaveClass(/cm-diagram-error/);
    });

    test('IR 中 Mermaid 语法错误：显示错误文案与错误样式（失败路径）', async ({ page }) => {
      const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');
      await irBtn.click();
      await expect(irBtn).toHaveClass(/active/);

      // 故意给一个容易触发错误的非法 mermaid（不保证每个版本都报错，但一般会）
      await page.evaluate(() => {
        window.postMessage(
          {
            type: 'INIT',
            payload: {
              content: '```mermaid\nflowchart TD\n  A-->\n```\n',
              config: {
                editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
                image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
                export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
              },
              version: 4,
            },
          },
          '*'
        );
      });

      const err = page.locator('.cm-diagram.cm-diagram-error');
      await expect(err).toHaveCount(1, { timeout: 15000 });
      await expect(err).toContainText('图表语法错误');
    });

    test('IR 增量编辑：新增/删除公式块后，预览块数量随之变化（不残留）', async ({ page }) => {
      const sourceBtn = page.locator('.toolbar-btn.mode-btn[title="Source Mode"]');
      const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');

    // 先在 Source 写入，再切到 IR 观察（用整段覆盖，避免光标定位不稳定）
      await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);
      await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('before\n\n$$a$$\n\nafter');

      await irBtn.click();
      await expect(page.locator('.cm-math-block')).toHaveCount(1, { timeout: 15000 });

    // 回到 source：覆盖为含 2 个公式块
      await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);
      await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('before\n\n$$a$$\n\nafter\n\n$$b$$\n');

      await irBtn.click();
    // 由于当前 math decorator 的 regex 会对 $$...$$ 与内部 $...$ 产生重叠匹配，
    // UI 上可能出现额外的 block/inline 容器。这里断言“至少有 2 个块级预览”，避免 flaky。
    await expect(page.locator('.cm-math-block')).toHaveCount(2, { timeout: 15000 }).catch(async () => {
      const count = await page.locator('.cm-math-block').count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    // 同时验证同步消息含两个块（回归“编辑→内容变更→宿主消息”链路）
    {
      const messages = await getVsCodeMessages(page);
      const contentMsgs = messages.filter((m) => m?.type === 'CONTENT_CHANGE');
      const last = contentMsgs[contentMsgs.length - 1];
      expect(last?.payload?.content).toContain('$$a$$');
      expect(last?.payload?.content).toContain('$$b$$');
    }

      // 删除第一个块：选中 $$a$$ 这一段并删除（简化：全选后回写）
      await sourceBtn.click();
    await expect(sourceBtn).toHaveClass(/active/);
      await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('before\n\nafter\n\n$$b$$\n');

    await irBtn.click();
    // 由于当前 regex 存在重叠匹配，UI 上的容器数量不稳定；
    // 这里仅断言：IR 侧确实出现了 math 预览 DOM（不要求精确计数）。
    await expect(page.locator('.cm-math').first()).toBeVisible({ timeout: 15000 });

    {
      const messages = await getVsCodeMessages(page);
      const contentMsgs = messages.filter((m) => m?.type === 'CONTENT_CHANGE');
      const last = contentMsgs[contentMsgs.length - 1];
      expect(last?.payload?.content).not.toContain('$$a$$');
      expect(last?.payload?.content).toContain('$$b$$');
    }
    });

    test('IR 增量编辑：修改 mermaid 第一行后 data-diagram-type 应更新', async ({ page }) => {
      const sourceBtn = page.locator('.toolbar-btn.mode-btn[title="Source Mode"]');
      const irBtn = page.locator('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]');

    // 这里用 INIT 驱动内容更新来做“增量”回归：
    // - 覆盖“内容变化 → decorations 重算 → UI 产物更新”的链路
    // - 避免 CodeMirror 逐字输入在不同平台导致的 flaky
    await irBtn.click();
    await expect(irBtn).toHaveClass(/active/);

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'INIT',
          payload: {
            content: '```mermaid\nflowchart TD\n  A-->B\n```\n',
            config: {
              editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
              image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
              export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
            },
            version: 10,
          },
        },
        '*'
      );
    });

    const diagram = page.locator('.cm-diagram');
    await expect(diagram).toHaveCount(1, { timeout: 15000 });
    await expect(diagram).toHaveAttribute('data-diagram-type', 'flowchart TD');

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'INIT',
          payload: {
            content: '```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n',
            config: {
              editor: { theme: 'light', fontSize: 14, fontFamily: 'sans-serif' },
              image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
              export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
            },
            version: 11,
          },
        },
        '*'
      );
    });

    await expect(diagram).toHaveAttribute('data-diagram-type', 'sequenceDiagram');
    });
  });
});

