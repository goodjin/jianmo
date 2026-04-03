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

/** 各用例可 reset 的基准文档（避免依赖上一次编辑） */
function defaultBaselineMd() {
  return [
    '# Title',
    '',
    '## Section B',
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
    throw new Error(
      `Markly toolbar not found within 60s. LastState=${lastState || 'unknown'}. LoadingText="${loadingText}"`
    );
  }
}

/** 进入 webview、初始化栏与 E2E 桥；用毕请 defaultContent */
async function enterMarklyEditorUi(editor) {
  const driver = VSBrowser.instance.driver;
  await switchToWebviewFrame(editor, 60000);
  await waitToolbarReady(driver);
  await driver.findElement(By.css('.cm-editor'));
  await driver.findElement(By.css('.toolbar-btn.mode-btn[title="IR Mode (WYSIWYG)"]'));
  await driver.findElement(By.css('.toolbar-btn.mode-btn[title="Source Mode"]'));

  await driver.wait(async () => {
    const ok = await driver.executeScript(() => !!window.__marklyE2E?.getContent);
    return !!ok;
  }, 60000, 'markly e2e bridge ready');

  return driver;
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
  const btn = await waitFor(driver, sel, 60000, `toolbar button: ${title}`);
  await btn.click();
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
  waitMarklyContent,
  clickToolbarButton,
  OUTLINE_PANEL,
  LINE_NUMBERS_HIDDEN,
  Key,
};
