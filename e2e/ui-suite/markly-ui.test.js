/**
 * 真 VS Code UI：vscode-extension-tester + WebDriver
 * 按功能拆分用例，失败时便于定位模块。
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const { VSBrowser } = require('vscode-extension-tester');
const {
  defaultBaselineMd,
  openMarklyWebviewEditor,
  enterMarklyEditorUi,
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
} = require('./ui-helpers');

const MOD = process.platform === 'darwin' ? Key.META : Key.CONTROL;

describe('Markly VS Code UI (ExTester)', function () {
  this.timeout(360000);

  /** @type {import('vscode-extension-tester').WebView} */
  let editor;
  /** @type {import('selenium-webdriver').WebDriver} */
  let driver;

  before(async function () {
    const session = await openMarklyWebviewEditor();
    editor = session.editor;
    driver = session.driver;
  });

  /** 每轮回到 IR、基准正文，避免用例间串味 */
  async function resetEditorState() {
    await driver.switchTo().defaultContent();
    await enterMarklyEditorUi(editor);
    await bridgeSwitchMode(driver, 'ir');
    const baseline = defaultBaselineMd();
    await bridgeSetContent(driver, baseline);
    await waitMarklyContent(driver, (t) => t.includes('# Title') && t.includes('Section B'), 60000);
  }

  afterEach(async function () {
    await driver.switchTo().defaultContent();
  });

  it('toggles outline and line number visibility from toolbar', async function () {
    await resetEditorState();
    await driver.wait(async () => (await driver.findElements(By.css(OUTLINE_PANEL))).length === 0, 60000, 'outline default hidden');

    await clickToolbarButton(driver, 'Toggle Outline');
    await driver.wait(async () => (await driver.findElements(By.css(OUTLINE_PANEL))).length > 0, 60000, 'outline visible');
    await clickToolbarButton(driver, 'Toggle Outline');
    await driver.wait(async () => (await driver.findElements(By.css(OUTLINE_PANEL))).length === 0, 60000, 'outline hidden');

    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.cm-editor')?.className || '');
      return cls.includes(LINE_NUMBERS_HIDDEN);
    }, 60000, 'line numbers default hidden');
    await clickToolbarButton(driver, 'Toggle Line Numbers');
    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.cm-editor')?.className || '');
      return !cls.includes(LINE_NUMBERS_HIDDEN);
    }, 60000, 'line numbers visible');
    await clickToolbarButton(driver, 'Toggle Line Numbers');
    await driver.wait(async () => {
      const cls = await driver.executeScript(() => document.querySelector('.cm-editor')?.className || '');
      return cls.includes(LINE_NUMBERS_HIDDEN);
    }, 60000, 'line numbers hidden again');
  });

  it('Source mode: bold, toolbar undo, toolbar redo', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => {
      const cls = await driver.executeScript(
        () => document.querySelector('.toolbar-btn.mode-btn[title="Source Mode"]')?.className || ''
      );
      return cls.includes('active');
    }, 60000);

    const cmContent = await driver.findElement(By.css('.cm-content'));
    await cmContent.click();
    await driver.actions().sendKeys(Key.chord(MOD, Key.END)).perform();
    await driver.actions().sendKeys('\nextra-line').perform();

    await clickToolbarButton(driver, 'Bold');
    await driver.actions().sendKeys('z').perform();
    let md = await waitMarklyContent(driver, (t) => t.includes('**z**'), 60000);
    assert.ok(md.includes('**z**'), md);

    await clickToolbarButton(driver, 'Undo (Ctrl+Z)');
    md = await waitMarklyContent(driver, (t) => !t.includes('**z**'), 60000);
    assert.ok(!md.includes('**z**'), md);
    await clickToolbarButton(driver, 'Redo (Ctrl+Shift+Z)');
    md = await waitMarklyContent(driver, (t) => t.includes('**z**'), 60000);
    assert.ok(md.includes('**z**'), md);
  });

  it('Source mode: toolbar inserts HR, code block, table, math', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => {
      const cls = await driver.executeScript(
        () => document.querySelector('.toolbar-btn.mode-btn[title="Source Mode"]')?.className || ''
      );
      return cls.includes('active');
    }, 60000);

    await clickToolbarButton(driver, 'Horizontal Rule');
    await clickToolbarButton(driver, 'Code Block');
    await clickToolbarButton(driver, 'Table');
    await clickToolbarButton(driver, 'Math Formula');
    const md = await bridgeGetContent(driver);
    assert.ok(md.includes('\n---\n'), 'horizontal rule');
    assert.ok(md.includes('\n```\n代码内容\n```\n'), 'code block');
    assert.ok(md.includes('| 列1 | 列2 | 列3 |'), 'table');
    assert.ok(md.includes('\n$$\nE = mc^2\n$$\n'), 'math');
  });

  it('Find/Replace panel: keyboard opens UI and Replace All changes markdown', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, 'ping pong ping\n');

    const cm = await driver.findElement(By.css('.cm-content'));
    await cm.click();
    // 物理 Cmd/Ctrl+F 常被 VS Code 宿主抢占；在 webview 内派发与 App.vue 相同的 keydown（真实走同一 handler）
    await driver.executeScript(() => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'f',
          bubbles: true,
          cancelable: true,
          metaKey: isMac,
          ctrlKey: !isMac,
        })
      );
    });

    await driver.wait(untilVisibleFindPanel(driver), 30000, 'find panel');
    const inputs = await driver.findElements(By.css('.find-replace-panel .panel-input'));
    assert.strictEqual(inputs.length, 2, 'find + replace inputs');
    await inputs[0].clear();
    await inputs[0].sendKeys('ping');
    await inputs[1].clear();
    await inputs[1].sendKeys('ding');

    const replaceAllBtn = await driver.findElement(
      By.xpath("//div[contains(@class,'find-replace-panel')]//button[contains(@class,'action-btn') and normalize-space()='全部替换']")
    );
    await replaceAllBtn.click();

    const md = await waitMarklyContent(driver, (t) => t.includes('ding pong ding'), 60000);
    assert.ok(md.includes('ding pong ding'), md);

    await driver.findElement(By.css('.find-replace-panel .close-btn')).click();
    await driver.wait(async () => (await driver.findElements(By.css('.find-replace-panel'))).length === 0, 10000);
  });

  it('Find/Replace panel: toolbar Find button opens UI', async function () {
    await resetEditorState();
    await clickToolbarButton(driver, '查找和替换 (Ctrl+F)');
    await driver.wait(untilVisibleFindPanel(driver), 30000, 'find panel from toolbar');
    const panels = await driver.findElements(By.css('.find-replace-panel'));
    assert.strictEqual(panels.length, 1, 'panel visible');
    await driver.findElement(By.css('.find-replace-panel .close-btn')).click();
    await driver.wait(async () => (await driver.findElements(By.css('.find-replace-panel'))).length === 0, 10000);
  });

  it('Source mode: headings H1/H3, inline formats, clear format', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'source');

    await bridgeSetContent(driver, 'plain\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Heading 1');
    let md = await waitMarklyContent(driver, (t) => /^# plain/m.test(t), 60000);
    assert.ok(md.startsWith('# plain'), md);

    await bridgeSetContent(driver, 'heading three\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Heading 3');
    md = await waitMarklyContent(driver, (t) => /^### heading three/m.test(t), 60000);
    assert.ok(md.startsWith('### heading three'), md);

    await bridgeSetContent(driver, 'alpha beta\n');
    await bridgeSetSelectionAnchor(driver, 6, 10);
    await clickToolbarButton(driver, 'Italic');
    md = await waitMarklyContent(driver, (t) => t.includes('*beta*'), 60000);
    assert.ok(md.includes('*beta*'), md);

    await bridgeSetContent(driver, 'wrapme\n');
    await bridgeSetSelectionAnchor(driver, 0, 6);
    await clickToolbarButton(driver, 'Strikethrough');
    md = await waitMarklyContent(driver, (t) => t.includes('~~wrapme~~'), 60000);
    assert.ok(md.includes('~~wrapme~~'), md);

    await bridgeSetContent(driver, 'codex\n');
    await bridgeSetSelectionAnchor(driver, 0, 5);
    await clickToolbarButton(driver, 'Inline Code');
    md = await waitMarklyContent(driver, (t) => t.includes('`codex`'), 60000);
    assert.ok(md.includes('`codex`'), md);

    await bridgeSetContent(driver, '## zzz\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Clear Format');
    md = await waitMarklyContent(driver, (t) => t.trim().startsWith('zzz'), 60000);
    assert.ok(md.includes('zzz') && !/^##\s/m.test(md), md);
  });

  it('Source mode: bullet, ordered, task list, quote', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'source');

    await bridgeSetContent(driver, 'item\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Bullet List');
    let md = await waitMarklyContent(driver, (t) => t.startsWith('- item'), 60000);
    assert.ok(md.startsWith('- item'), md);

    await bridgeSetContent(driver, 'n2\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Ordered List');
    md = await waitMarklyContent(driver, (t) => /^1\.\s+n2/m.test(t), 60000);
    assert.ok(/^1\.\s+n2/m.test(md), md);

    await bridgeSetContent(driver, 'tchk\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Task List');
    md = await waitMarklyContent(driver, (t) => t.startsWith('- [ ] tchk'), 60000);
    assert.ok(md.startsWith('- [ ] tchk'), md);

    await bridgeSetContent(driver, 'qq\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Quote');
    md = await waitMarklyContent(driver, (t) => t.startsWith('> qq'), 60000);
    assert.ok(md.startsWith('> qq'), md);
  });

  it('IR mode: heading from toolbar respects line cursor', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'ir');
    await bridgeSetContent(driver, 'plain line\nsecond\n');
    await bridgeSetSelectionAnchor(driver, 0);
    await clickToolbarButton(driver, 'Heading 2');
    const md = await waitMarklyContent(driver, (t) => /^## plain line/m.test(t), 60000);
    assert.ok(md.startsWith('## plain line'), md);
  });

  it('outline panel click jumps caret to heading line', async function () {
    await resetEditorState();
    await clickToolbarButton(driver, 'Toggle Outline');
    await driver.wait(async () => (await driver.findElements(By.css(OUTLINE_PANEL))).length > 0, 60000, 'outline open');
    const md0 = await bridgeGetContent(driver);
    const sectionIdx = md0.indexOf('## Section B');
    assert.ok(sectionIdx >= 0, 'fixture must contain ## Section B');

    await driver.wait(async () => (await driver.findElements(By.css('.outline-item'))).length >= 2, 60000);
    const item = await driver.findElement(
      By.xpath("//div[contains(@class,'outline-item')][normalize-space()='Section B']")
    );
    await bridgeSetSelectionAnchor(driver, 0);
    const before = await bridgeGetSelectionAnchor(driver);
    assert.strictEqual(before, 0);
    await item.click();

    await driver.wait(async () => (await bridgeGetSelectionAnchor(driver)) === sectionIdx, 30000, 'caret at Section B');
  });

  it('insert Link uses prompt answers (no native dialog interaction)', async function () {
    await resetEditorState();
    await driver.executeScript(() => {
      window.__marklyOrigPrompt = window.prompt.bind(window);
      window.prompt = (msg) => {
        const m = String(msg || '');
        if (m.includes('文字')) return 'e2e-link';
        if (m.includes('地址')) return 'https://e2e.example/ui';
        return '';
      };
    });
    await bridgeSetContent(driver, 'x\n');
    await bridgeSetSelectionAnchor(driver, 2);
    await clickToolbarButton(driver, 'Link');
    const md = await waitMarklyContent(driver, (t) => t.includes('[e2e-link](https://e2e.example/ui)'), 60000);
    assert.ok(md.includes('[e2e-link](https://e2e.example/ui)'), md);
    await driver.executeScript(() => {
      const o = window.__marklyOrigPrompt;
      if (typeof o === 'function') window.prompt = o;
    });
  });

  it('word count strip updates when content changes', async function () {
    await resetEditorState();
    let bar = await driver.findElement(By.css('.word-count')).getText();
    assert.ok(bar.includes('字数:'), bar);

    await bridgeSetContent(driver, `${'测'.repeat(40)}\n`);
    await driver.wait(async () => {
      bar = await driver.findElement(By.css('.word-count')).getText();
      return bar.includes('字数: 40');
    }, 30000, 'word count 40');
  });

  it('replaceAll still works via E2E bridge (regression guard)', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, 'one two one\n');
    await driver.executeScript(() =>
      window.__marklyE2E?.replaceAll?.('one', 'NE', { caseSensitive: true, useRegex: false })
    );
    const md = await waitMarklyContent(driver, (t) => t.includes('NE two NE'), 60000);
    assert.ok(md.includes('NE two NE'), md);
  });
});

function untilVisibleFindPanel(driver) {
  return async () => (await driver.findElements(By.css('.find-replace-panel'))).length > 0;
}
