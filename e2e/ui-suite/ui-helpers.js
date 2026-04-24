/**
 * ExTester UI 共享：打开 Markly 自定义编辑器、切 webview frame、工具栏与 E2E 桥
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

const FIXTURE_ROOT = path.resolve(__dirname, 'fixture-workspace');
const SECTION_TITLE = path.basename(FIXTURE_ROOT);

/** 各用例可 reset 的基准文档（避免依赖上一次编辑；保持轻量以便 Rich 在 5s 内完成 Milkdown 渲染） */
function defaultBaselineMd() {
  return ['# Title', '', '## Section B', '', 'alpha beta', ''].join('\n');
}

function writeSampleMd(content) {
  fs.writeFileSync(path.join(FIXTURE_ROOT, 'sample.md'), content, 'utf8');
}

/**
 * @returns {Promise<{ driver: import('selenium-webdriver').WebDriver; editor: WebView; wb: Workbench }>}
 */
async function openMarklyWebviewEditor() {
  const driver = VSBrowser.instance.driver;
  const wb = new Workbench();

  writeSampleMd(defaultBaselineMd());

  const explorer = await new ActivityBar().getViewControl('Explorer');
  assert.ok(explorer, 'Explorer activity should exist');
  await explorer.openView();

  const sideContent = new SideBarView().getContent();

  let tree;
  try {
    tree = await sideContent.getSection(SECTION_TITLE, DefaultTreeSection);
  } catch {
    const sections = await sideContent.getSections();
    assert.ok(sections.length > 0, 'Explorer should have at least one section');
    const title = await sections[0].getTitle();
    tree = await sideContent.getSection(title, DefaultTreeSection);
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
  return { driver, editor, wb };
}

async function switchToWebviewFrame(editor, timeoutMs = 60000) {
  const driver = VSBrowser.instance.driver;
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      await driver.switchTo().defaultContent();
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

async function waitFor(driver, selector, timeoutMs, message) {
  await driver.wait(until.elementLocated(By.css(selector)), timeoutMs, message || selector);
  return driver.findElement(By.css(selector));
}

async function waitToolbarReady(driver) {
  const toolbarSelector = '.toolbar';
  const loadingSelector = '.loading';
  const deadline = Date.now() + 60000;
  let lastState = '';
  while (Date.now() < deadline) {
    const toolbarEls = await driver.findElements(By.css(toolbarSelector));
    if (toolbarEls.length > 0) return;

    const loadingEls = await driver.findElements(By.css(loadingSelector));
    if (loadingEls.length > 0) lastState = 'loading';

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }

  const toolbarEls = await driver.findElements(By.css(toolbarSelector));
  if (toolbarEls.length === 0) {
    const loadingEls = await driver.findElements(By.css(loadingSelector));
    const loadingText = loadingEls.length > 0 ? await loadingEls[0].getText() : '';
    let bodyText = '';
    let href = '';
    try {
      href = String(await driver.executeScript(() => location.href));
      bodyText = String(
        await driver.executeScript(() => (document.body?.innerText || '').trim().slice(0, 600))
      );
    } catch {
      // ignore
    }
    throw new Error(
      `Markly toolbar not found within 60s. LastState=${lastState || 'unknown'}. LoadingText="${loadingText}". Href="${href}". BodyText="${bodyText}"`
    );
  }
}

/** 进入 webview、初始化栏与 E2E 桥；用毕请 defaultContent */
async function enterMarklyEditorUi(editor) {
  const driver = VSBrowser.instance.driver;
  const editorView = new EditorView();
  const wb = new Workbench();

  // WebView 在部分场景会被 VS Code 重建（frame 句柄失效、元素 stale）。
  // 这里做有限次重试：重新定位 editor、切 frame、等待 toolbar 与 bridge。
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await driver.switchTo().defaultContent();

      // 重新获取当前 editor 实例，避免持有过期 WebView 引用
      // eslint-disable-next-line no-await-in-loop
      const current = await editorView.openEditor('sample.md');
      let webview = current;
      if (webview instanceof TextEditor) {
        // 有时 VS Code 会把自定义编辑器回退成 TextEditor（例如窗口重建、扩展重载）。
        // 此时重新执行“Reopen Editor With...”选回 Markly Preview。
        // eslint-disable-next-line no-await-in-loop
        await wb.executeCommand('Reopen Editor With...');
        // eslint-disable-next-line no-await-in-loop
        const box = await InputBox.create(30000);
        // eslint-disable-next-line no-await-in-loop
        await box.selectQuickPick('Markly Preview');
        // eslint-disable-next-line no-await-in-loop
        await VSBrowser.instance.driver.wait(
          until.elementLocated(EditorView.locators.EditorView.webView),
          60000,
          'custom editor webview container'
        );
        // eslint-disable-next-line no-await-in-loop
        webview = await editorView.openEditor('sample.md');
      }
      // eslint-disable-next-line no-await-in-loop
      if (!(webview instanceof WebView)) {
        webview = editor;
      }

      // eslint-disable-next-line no-await-in-loop
      await switchToWebviewFrame(webview, 60000);
      // eslint-disable-next-line no-await-in-loop
      await waitToolbarReady(driver);

      // eslint-disable-next-line no-await-in-loop
      await driver.findElement(By.css('.toolbar'));
      // eslint-disable-next-line no-await-in-loop
      await driver.findElement(By.css('.cm-editor'));
      // eslint-disable-next-line no-await-in-loop
      await driver.findElement(By.css('.toolbar-btn.mode-btn[title="Rich Mode (WYSIWYG)"]'));
      // eslint-disable-next-line no-await-in-loop
      await driver.findElement(By.css('.toolbar-btn.mode-btn[title="Source Mode"]'));

      // eslint-disable-next-line no-await-in-loop
      await driver.wait(async () => {
        const ok = await driver.executeScript(() => !!window.__marklyE2E?.getContent);
        return !!ok;
      }, 60000, 'markly e2e bridge ready');

      return driver;
    } catch (e) {
      lastErr = e;
      // 若窗口/会话已提前关闭，直接退出重试循环（继续操作 driver 只会制造更多噪音）
      const rawMsg = String(e && (e.stack || e.message || e));
      if (rawMsg.includes('no such window') || rawMsg.includes('web view not found')) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      try {
        await driver.switchTo().defaultContent();
      } catch {
        break;
      }
      // 若 webview 进入 VS Code 的“红字 Error”页（常见于未捕获 MilkdownError），尝试关闭并重开编辑器触发 webview 重建
      const msg = rawMsg;
      if (msg.includes('MilkdownError') && msg.includes('Context \"editorView\" not found')) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await wb.executeCommand('workbench.action.closeActiveEditor');
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 500));
          // 通过 Explorer 重新打开文件（避免 editor tab 已不存在导致 openEditor 抛错）
          // eslint-disable-next-line no-await-in-loop
          const explorer = await new ActivityBar().getViewControl('Explorer');
          if (explorer) {
            // eslint-disable-next-line no-await-in-loop
            await explorer.openView();
            const sideContent = new SideBarView().getContent();
            let tree;
            try {
              // eslint-disable-next-line no-await-in-loop
              tree = await sideContent.getSection(SECTION_TITLE, DefaultTreeSection);
            } catch {
              // eslint-disable-next-line no-await-in-loop
              const sections = await sideContent.getSections();
              if (sections.length > 0) {
                // eslint-disable-next-line no-await-in-loop
                const title = await sections[0].getTitle();
                // eslint-disable-next-line no-await-in-loop
                tree = await sideContent.getSection(title, DefaultTreeSection);
              }
            }
            if (tree) {
              // eslint-disable-next-line no-await-in-loop
              await tree.openItem('sample.md');
            }
          }
        } catch {
          // ignore
        }
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr ?? new Error('enterMarklyEditorUi failed');
}

function bridgeGetContent(driver) {
  return driver.executeScript(() => window.__marklyE2E?.getContent?.() || '');
}

function bridgeSetContent(driver, text) {
  return driver.executeScript((t) => window.__marklyE2E?.setContent?.(t), text);
}

function bridgeGetSelectionAnchor(driver) {
  return driver.executeScript(() => window.__marklyE2E?.getSelectionAnchor?.() ?? -1);
}

function bridgeSetSelectionAnchor(driver, anchor, head) {
  if (head === undefined) {
    return driver.executeScript((a) => window.__marklyE2E?.setSelectionAnchor?.(a), anchor);
  }
  return driver.executeScript((a, h) => window.__marklyE2E?.setSelectionAnchor?.(a, h), anchor, head);
}

function bridgeSwitchMode(driver, mode) {
  return driver.executeScript((m) => window.__marklyE2E?.switchMode?.(m), mode);
}

function bridgeGetEditorMode(driver) {
  return driver.executeScript(() => window.__marklyE2E?.getEditorMode?.() ?? null);
}

function bridgeGetRichPmSelection(driver) {
  return driver.executeScript(() => window.__marklyE2E?.getRichPmSelection?.() ?? null);
}

/** Rich：等待「文档已画进 Milkdown」（冷启动/CI 可能较慢，默认 15s） */
async function waitRichDocumentPainted(driver, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastDiag = null;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await driver.executeScript(() => window.__marklyE2E?.isRichDocumentPainted?.() === true);
    if (ok === true) return;
    // eslint-disable-next-line no-await-in-loop
    lastDiag = await driver.executeScript(() => window.__marklyE2E?.getDiagnostics?.() ?? null);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(
    false,
    `Rich ${timeoutMs}ms 内渲染未就绪（须：标题节点含 Section B、可编辑区、子树含 Section B）。\nDiagnostics:\n${JSON.stringify(
      lastDiag,
      null,
      2
    )}`
  );
}

async function waitMarklyContent(driver, predicate, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    last = String((await bridgeGetContent(driver)) || '');
    if (predicate(last)) return last;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(false, `markly content did not satisfy predicate within ${timeoutMs}ms.\nlast:\n${last}`);
  return last;
}

async function clickToolbarButton(driver, title) {
  const sel = `.toolbar .toolbar-btn[title="${title}"]`;
  // 避免 stale element：每次现查现点，失败则重试一次
  for (let i = 0; i < 2; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const btn = await waitFor(driver, sel, 60000, `toolbar button: ${title}`);
      // eslint-disable-next-line no-await-in-loop
      await btn.click();
      return;
    } catch (e) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
      if (i === 1) throw e;
    }
  }
}

const OUTLINE_PANEL = '.outline-panel';
const LINE_NUMBERS_HIDDEN = 'cm-hide-line-numbers';

module.exports = {
  FIXTURE_ROOT,
  SECTION_TITLE,
  defaultBaselineMd,
  writeSampleMd,
  openMarklyWebviewEditor,
  switchToWebviewFrame,
  enterMarklyEditorUi,
  waitFor,
  waitToolbarReady,
  bridgeGetContent,
  bridgeSetContent,
  bridgeGetSelectionAnchor,
  bridgeSetSelectionAnchor,
  bridgeSwitchMode,
  bridgeGetEditorMode,
  bridgeGetRichPmSelection,
  waitRichDocumentPainted,
  waitMarklyContent,
  clickToolbarButton,
  OUTLINE_PANEL,
  LINE_NUMBERS_HIDDEN,
  Key,
};
