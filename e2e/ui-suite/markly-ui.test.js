/**
 * 真 VS Code UI：vscode-extension-tester + WebDriver
 * 由 `extest run-tests` 启动 VS Code 后执行（见 package.json `test:vscode:ui`）
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { By, Key, until } = require('selenium-webdriver');
const {
  ActivityBar,
  SideBarView,
  Workbench,
  EditorView,
  InputBox,
  WebView,
  TextEditor,
  DefaultTreeSection,
  VSBrowser,
} = require('vscode-extension-tester');

describe('Markly VS Code UI (ExTester)', function () {
  this.timeout(180000);

  it('covers core toolbar behaviors (mode/format/insert/undo/redo/toggles)', async function () {
    const driver = VSBrowser.instance.driver;

    const fixtureRoot = path.resolve(__dirname, 'fixture-workspace');
    const sectionTitle = path.basename(fixtureRoot);
    const wb = new Workbench();

    // 确保每次用例从一致的初始内容开始（否则前一次跑留下的编辑会让断言失真）
    const baseline = [
      '# Title',
      '',
      'alpha beta',
      '',
      'Inline $x^2$ and block:',
      '',
      '$$',
      'E=mc^2',
      '$$',
      '',
      '```mermaid',
      'flowchart TD',
      '  A-->B',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(fixtureRoot, 'sample.md'), baseline, 'utf8');

    const explorer = await new ActivityBar().getViewControl('Explorer');
    assert.ok(explorer, 'Explorer activity should exist');
    await explorer.openView();

    const content = new SideBarView().getContent();
    let tree;
    try {
      tree = await content.getSection(sectionTitle, DefaultTreeSection);
    } catch {
      const sections = await content.getSections();
      assert.ok(sections.length > 0, 'Explorer should have at least one section');
      const title = await sections[0].getTitle();
      tree = await content.getSection(title, DefaultTreeSection);
    }
    await tree.openItem('sample.md');

    const editorView = new EditorView();
    let editor = await editorView.openEditor('sample.md');

    if (editor instanceof TextEditor) {
      await wb.executeCommand('Reopen Editor With...');
      const box = await InputBox.create(30000);
      await box.selectQuickPick('Markly Preview');
      await VSBrowser.instance.driver.wait(
        until.elementLocated(EditorView.locators.EditorView.webView),
        60000,
        'custom editor webview container'
      );
      editor = await editorView.openEditor('sample.md');
    }

    assert.ok(editor instanceof WebView, `expected WebView editor, got ${editor?.constructor?.name}`);

    async function switchToWebviewFrame(timeoutMs = 60000) {
      const deadline = Date.now() + timeoutMs;
      let lastErr = null;
      while (Date.now() < deadline) {
        try {
          // VS Code 新版本的 webview 容器可能不直接暴露为普通 iframe（可能在 webview/shadow DOM 内）。
          // 使用 vscode-extension-tester 提供的 WebView.switchToFrame，它能处理不同 VS Code 版本的差异。
          await editor.switchToFrame();
          return;
        } catch (e) {
          lastErr = e;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      throw lastErr ?? new Error('switchToFrame timeout');
    }

    await switchToWebviewFrame(60000);

    async function waitFor(selector, timeoutMs, message) {
      await driver.wait(until.elementLocated(By.css(selector)), timeoutMs, message || selector);
      return await driver.findElement(By.css(selector));
    }

    async function getMarklyContent() {
      return await driver.executeScript(() => window.__marklyE2E?.getContent?.() || '');
    }

    async function setMarklyContent(text) {
      await driver.executeScript((t) => window.__marklyE2E?.setContent?.(t), text);
    }

    async function waitMarklyContent(predicate, timeoutMs = 60000) {
      const deadline = Date.now() + timeoutMs;
      let last = '';
      while (Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        last = String((await getMarklyContent()) || '');
        if (predicate(last)) return last;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(false, `markly content did not satisfy predicate within ${timeoutMs}ms.\nlast:\n${last}`);
      return last;
    }

    async function clickToolbarButton(title) {
      const sel = `.toolbar .toolbar-btn[title="${title}"]`;
      const btn = await waitFor(sel, 60000, `toolbar button: ${title}`);
      await btn.click();
    }

    const toolbarSelector = '.toolbar';
    const loadingSelector = '.loading';
    const deadline = Date.now() + 60000;
    let lastState = '';
    while (Date.now() < deadline) {
      const toolbarEls = await driver.findElements(By.css(toolbarSelector));
      if (toolbarEls.length > 0) break;

      const loadingEls = await driver.findElements(By.css(loadingSelector));
      if (loadingEls.length > 0) lastState = 'loading';

      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }

    const toolbarEls = await driver.findElements(By.css(toolbarSelector));
    if (toolbarEls.length === 0) {
      const loadingEls = await driver.findElements(By.css(loadingSelector));
      const loadingText = loadingEls.length > 0 ? await loadingEls[0].getText() : '';
      throw new Error(
        `Markly toolbar not found within 60s. LastState=${lastState || 'unknown'}. LoadingText="${loadingText}"`
      );
    }

    await driver.findElement(By.css('.cm-editor'));
    await driver.findElement(By.css('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]'));
    await driver.findElement(By.css('.toolbar-btn.mode-btn[title="Source Mode"]'));

    // 等待 e2e bridge 就绪（App.vue 会在 editorReady 时挂到 window 上）
    await driver.wait(async () => {
      const ok = await driver.executeScript(() => !!window.__marklyE2E?.getContent);
      return !!ok;
    }, 60000, 'markly e2e bridge ready');

    // 1) Outline / Line numbers toggle：仅验证 UI 状态变化（行为可观测且稳定）
    const outlinePanelSel = '.outline-panel';
    const lineNumbersHiddenClass = 'cm-hide-line-numbers';

    // Outline 默认开启（App.vue showOutline=true）
    await waitFor(outlinePanelSel, 60000, 'outline panel visible by default');
    await clickToolbarButton('Toggle Outline');
    await driver.wait(async () => (await driver.findElements(By.css(outlinePanelSel))).length === 0, 60000, 'outline panel hidden');
    await clickToolbarButton('Toggle Outline');
    await waitFor(outlinePanelSel, 60000, 'outline panel visible again');

    // Line numbers 默认开启（App.vue showLineNumbers=true），点击一次应隐藏（cm-editor 增加 class）
    await clickToolbarButton('Toggle Line Numbers');
    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.cm-editor')?.className || '');
      return cls.includes(lineNumbersHiddenClass);
    }, 60000, 'line numbers hidden class applied');
    await clickToolbarButton('Toggle Line Numbers');
    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.cm-editor')?.className || '');
      return !cls.includes(lineNumbersHiddenClass);
    }, 60000, 'line numbers hidden class removed');

    // 2) 在 Source 模式下用“原始 markdown 内容”做强断言
    await setMarklyContent(baseline);
    await waitMarklyContent((t) => t.includes('# Title') && t.includes('alpha beta'), 60000);

    await clickToolbarButton('Source Mode');
    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.toolbar-btn.mode-btn[title="Source Mode"]')?.className || '');
      return cls.includes('active');
    }, 60000, 'source mode active');

    const cmContent = await waitFor('.cm-content', 60000, 'cm content');
    await cmContent.click();
    // 移动到文末并插入一行用于操作
    await driver.actions().sendKeys(Key.chord(Key.META, Key.END)).perform();
    await driver.actions().sendKeys('\nui-test').perform();

    // 3) Bold：点击后再输入一个字符，应形成 **x**
    await clickToolbarButton('Bold');
    await driver.actions().sendKeys('x').perform();
    let md = await waitMarklyContent((t) => t.includes('**x**'), 60000);
    assert.ok(md.includes('**x**'), `expected bold markdown in content, got:\n${md}`);
    const undoDepthBefore = await driver.executeScript(() => window.__marklyE2E?.getUndoDepth?.() || 0);
    assert.ok(undoDepthBefore > 0, `expected undoDepth > 0 after edits, got ${undoDepthBefore}`);

    // 4) Undo / Redo：点击工具栏按钮（调用 Markly 的 undo/redo 实现）
    await clickToolbarButton('Undo (Ctrl+Z)');
    md = await waitMarklyContent((t) => !t.includes('**x**'), 60000);
    assert.ok(!md.includes('**x**'), `expected undo to remove '**x**', got:\n${md}`);
    await clickToolbarButton('Redo (Ctrl+Shift+Z)');
    md = await waitMarklyContent((t) => t.includes('**x**'), 60000);
    assert.ok(md.includes('**x**'), `expected redo to restore '**x**', got:\n${md}`);

    // 5) 插入：HR / CodeBlock / Table / Math（不依赖 prompt，断言插入 markdown 片段）
    await clickToolbarButton('Horizontal Rule');
    await clickToolbarButton('Code Block');
    await clickToolbarButton('Table');
    await clickToolbarButton('Math Formula');
    md = await getMarklyContent();
    assert.ok(md.includes('\n---\n'), 'expected horizontal rule inserted');
    assert.ok(md.includes('\n```\n代码内容\n```\n'), 'expected code block inserted');
    assert.ok(md.includes('| 列1 | 列2 | 列3 |'), 'expected table inserted');
    assert.ok(md.includes('\n$$\nE = mc^2\n$$\n'), 'expected math block inserted');

    // 6) Replace All（直接用 bridge 调用 App.vue 逻辑，验证内容变化）
    await driver.executeScript(() => window.__marklyE2E?.replaceAll?.('alpha', 'ALPHA', { caseSensitive: true, useRegex: false }));
    md = await waitMarklyContent((t) => t.includes('ALPHA beta'), 60000);
    assert.ok(md.includes('ALPHA beta'), `expected replaceAll to work, got:\n${md}`);

    // 切回工作区（避免对后续用例产生影响）
    await driver.switchTo().defaultContent();
  });
});
