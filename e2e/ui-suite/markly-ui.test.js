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
  bridgeGetEditorMode,
  bridgeGetRichPmSelection,
  waitRichDocumentPainted,
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

  /** 每轮回到 Rich、基准正文，避免用例间串味 */
  async function resetEditorState() {
    await driver.switchTo().defaultContent();
    await enterMarklyEditorUi(editor);
    const baseline = defaultBaselineMd();
    // 先卸掉 Milkdown（Source），再写入基准，再切 Rich：避免「已在 Rich 时 setContent」与 Milkdown 异步 create 竞态，DOM 长期与 content.value 不一致
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 60000, 'reset: source mode active');
    await bridgeSetContent(driver, baseline);
    await waitMarklyContent(driver, (t) => t.includes('# Title') && t.includes('Section B'), 60000);
    await bridgeSwitchMode(driver, 'rich');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'rich', 60000, 'reset: rich mode active');
    await waitMarklyContent(driver, (t) => t.includes('# Title') && t.includes('Section B'), 60000);
    if ((await bridgeGetEditorMode(driver)) === 'rich') {
      await waitRichDocumentPainted(driver, 15000);
    }
  }

  /** 基准正文 + Source（不依赖 Rich/Milkdown 就绪，用于纯 CM6 相关用例，避免 Rich 偶发重建影响） */
  async function resetEditorStateSource() {
    await driver.switchTo().defaultContent();
    await enterMarklyEditorUi(editor);
    const baseline = defaultBaselineMd();
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 60000, 'reset: source mode active');
    await bridgeSetContent(driver, baseline);
    await waitMarklyContent(driver, (t) => t.includes('# Title') && t.includes('Section B'), 60000);
  }

  afterEach(async function () {
    try {
      await driver.switchTo().defaultContent();
    } catch (e) {
      // VS Code/Chromium 偶发提前关闭窗口时，不要让 afterEach 把错误放大成额外失败
      const msg = String(e && (e.stack || e.message || e));
      if (msg.includes('no such window') || msg.includes('web view not found')) return;
      throw e;
    }
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

    await driver.wait(async () => (await driver.findElements(By.css('.milkdown-editor'))).length > 0, 60000, 'milkdown editor');
    const ed = await driver.findElement(By.css('.milkdown-editor'));
    await ed.click();
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

    const replaceAllBtn = await driver.findElement(By.css('.find-replace-panel button[title="全部替换"]'));
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

  it('toolbar: Rich → Source → Rich round-trip (getEditorMode + active button)', async function () {
    await resetEditorState();
    let m = await bridgeGetEditorMode(driver);
    assert.strictEqual(m, 'rich', 'default Rich');

    await clickToolbarButton(driver, 'Source Mode');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 30000, 'mode source');
    await driver.wait(async () => {
      const cls = await driver.executeScript(
        () => document.querySelector('.toolbar-btn.mode-btn[title="Source Mode"]')?.className || ''
      );
      return cls.includes('active');
    }, 30000, 'Source toolbar active');

    await clickToolbarButton(driver, 'Rich Mode (WYSIWYG)');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'rich', 30000, 'mode rich again');
    await driver.wait(async () => {
      const cls = await driver.executeScript(
        () => document.querySelector('.toolbar-btn.mode-btn[title="Rich Mode (WYSIWYG)"]')?.className || ''
      );
      return cls.includes('active');
    }, 30000, 'Rich toolbar active');
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
    const mode = await bridgeGetEditorMode(driver);
    const item = await driver.findElement(
      By.xpath("//button[contains(@class,'outline-item')][normalize-space()='Section B']")
    );
    if (mode !== 'rich') {
      await bridgeSetSelectionAnchor(driver, 0);
      const before = await bridgeGetSelectionAnchor(driver);
      assert.strictEqual(before, 0);
    }
    await item.click();

    if (mode === 'rich') {
      await driver.wait(
        async () =>
          (await driver.executeScript(() => {
            const root = document.querySelector('.milkdown-editor');
            if (!root) return false;
            const h = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).find((el) =>
              String(el.textContent || '').includes('Section B')
            );
            if (!h) return false;
            const rr = root.getBoundingClientRect();
            const hr = h.getBoundingClientRect();
            return hr.height > 0 && hr.bottom > rr.top && hr.top < rr.bottom;
          })) === true,
        10000,
        'rich: 大纲跳转后 Section B 未进入 Milkdown 滚动视口'
      );
    } else {
      await driver.wait(async () => (await bridgeGetSelectionAnchor(driver)) === sectionIdx, 30000, 'caret at Section B');
    }
  });

  it('Rich mode: Tab moves selection inside inserted table (not swallowed by global indent)', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length > 0) {
        firstBodyCell = els[0];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(firstBodyCell, 'rich table body cell exists');
    await firstBodyCell.click();

    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');
    const s0 = await bridgeGetRichPmSelection(driver);
    assert.ok(s0 && s0.inTable, JSON.stringify(s0));

    await driver.actions().sendKeys(Key.TAB).perform();
    await driver.wait(async () => {
      const s = await bridgeGetRichPmSelection(driver);
      if (!s || !s.inTable) return false;
      return s.from !== s0.from;
    }, 30000, 'tab should move caret within table');
    const s1 = await bridgeGetRichPmSelection(driver);
    assert.ok(s1 && s1.inTable, JSON.stringify(s1));
    assert.notStrictEqual(s1.from, s0.from);
  });

  it('Rich mode: Shift+Tab moves selection to previous table cell', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let secondBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length >= 2) {
        secondBodyCell = els[1];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(secondBodyCell, 'rich table second body cell exists');
    await secondBodyCell.click();

    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');
    const s0 = await bridgeGetRichPmSelection(driver);
    assert.ok(s0 && s0.inTable, JSON.stringify(s0));

    await driver.actions().keyDown(Key.SHIFT).sendKeys(Key.TAB).keyUp(Key.SHIFT).perform();
    await driver.wait(async () => {
      const s = await bridgeGetRichPmSelection(driver);
      if (!s || !s.inTable) return false;
      return s.from !== s0.from;
    }, 30000, 'shift+tab should move caret within table');
    const s1 = await bridgeGetRichPmSelection(driver);
    assert.ok(s1 && s1.inTable, JSON.stringify(s1));
    assert.notStrictEqual(s1.from, s0.from);
  });

  it('Rich mode: Tab indents list item and Shift+Tab outdents', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '- a\n- b\n');
    await waitMarklyContent(driver, (t) => t.includes('- a') && t.includes('- b'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let secondLi = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const lis = await driver.findElements(By.css('.milkdown-editor li'));
      if (lis.length >= 2) {
        secondLi = lis[1];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(secondLi, 'rich list second item exists');
    await secondLi.click();

    await driver.actions().sendKeys(Key.TAB).perform();
    let md = await waitMarklyContent(driver, (t) => /\n\s+- b\b/.test(t), 60000);
    assert.ok(/\n\s+- b\b/.test(md), md);

    await driver.actions().keyDown(Key.SHIFT).sendKeys(Key.TAB).keyUp(Key.SHIFT).perform();
    md = await waitMarklyContent(driver, (t) => /\n- b\b/.test(t), 60000);
    assert.ok(/\n- b\b/.test(md), md);
  });

  it('Rich mode: Mod+Alt+ArrowDown adds a table row (structure edit)', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length > 0) {
        firstBodyCell = els[0];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(firstBodyCell, 'rich table body cell exists');
    await firstBodyCell.click();
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const countPipeLines = async () => {
      const md = await bridgeGetContent(driver);
      return md.split('\n').filter((l) => l.includes('|')).length;
    };
    const n0 = await countPipeLines();
    await driver.actions().sendKeys(Key.chord(MOD, Key.ALT, Key.ARROW_DOWN)).perform();
    await driver.wait(async () => (await countPipeLines()) > n0, 30000, 'markdown table line count should increase');
  });

  it('Rich mode: toolbar "insert row below" adds a table row (structure edit)', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length > 0) {
        firstBodyCell = els[0];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(firstBodyCell, 'rich table body cell exists');
    await firstBodyCell.click();
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const countPipeLines = async () => {
      const md = await bridgeGetContent(driver);
      return md.split('\n').filter((l) => l.includes('|')).length;
    };
    const n0 = await countPipeLines();
    const insertBelowTitle = await driver.executeScript(() => {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const m = isMac ? '⌘' : 'Ctrl';
      return `表格：下方插入行（${m}+⌥+↓）`;
    });
    await clickToolbarButton(driver, insertBelowTitle);
    await driver.wait(async () => (await countPipeLines()) > n0, 30000, 'toolbar add row below should increase pipe lines');
  });

  it('Rich mode: context menu "insert row below" adds a table row (structure edit)', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length > 0) {
        firstBodyCell = els[0];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(firstBodyCell, 'rich table body cell exists');
    await firstBodyCell.click();
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const countPipeLines = async () => {
      const md = await bridgeGetContent(driver);
      return md.split('\n').filter((l) => l.includes('|')).length;
    };
    const n0 = await countPipeLines();

    await driver.actions().contextClick(firstBodyCell).perform();
    const menuBtn = await driver.findElement(By.css('[data-testid="rich-table-op-addRowAfter"]'));
    await menuBtn.click();

    await driver.wait(async () => (await countPipeLines()) > n0, 30000, 'context menu add row below should increase pipe lines');
  });

  it('Rich mode: E2E bridge simulates TSV paste inside table', async function () {
    await resetEditorState();
    await bridgeSetContent(driver, '# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const deadline = Date.now() + 60000;
    /** @type {import('selenium-webdriver').WebElement | null} */
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td'));
      if (els.length > 0) {
        firstBodyCell = els[0];
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(firstBodyCell, 'rich table body cell exists');
    await firstBodyCell.click();
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const md0 = await bridgeGetContent(driver);
    await driver.executeScript(() => window.__marklyE2E?.simulateRichTablePaste?.({ plain: 'A\tB\nC\tD\n' }));
    const md1 = await waitMarklyContent(driver, (t) => t !== md0, 60000);
    assert.ok(md1.includes('A') && md1.includes('D'), md1);
  });

  it('insert Link uses prompt answers (no native dialog interaction)', async function () {
    await resetEditorState();
    await bridgeSwitchMode(driver, 'source');
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
    await resetEditorStateSource();
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 60000, 'source mode active');
    await bridgeSetContent(driver, 'one two one\n');
    await driver.executeScript(() =>
      window.__marklyE2E?.replaceAll?.('one', 'NE', { caseSensitive: true, useRegex: false })
    );
    const md = await waitMarklyContent(driver, (t) => t.includes('NE two NE'), 60000);
    assert.ok(md.includes('NE two NE'), md);
  });

  it('click .cm-content moves focus inside .cm-editor (caret / mousedown handler)', async function () {
    await resetEditorStateSource();
    await driver.executeScript(() => {
      document.body.focus();
      const a = document.activeElement;
      if (a && a !== document.body) (a).blur?.();
    });
    const cm = await driver.findElement(By.css('.cm-content'));
    await cm.click();
    const ok = await driver.executeScript(() => {
      const ed = document.querySelector('.cm-editor');
      const ae = document.activeElement;
      return !!(ed && ae && ed.contains(ae));
    });
    assert.ok(ok, 'activeElement should be inside .cm-editor after click');
  });

  it('theme-dark: selection layer background is not pure white (contrast with light text)', async function () {
    await resetEditorStateSource();
    const isDark = await driver.executeScript(
      () => document.querySelector('.md-editor-app')?.classList.contains('theme-dark') === true
    );
    if (!isDark) {
      this.skip();
    }
    await bridgeSetContent(driver, 'selectme\n');
    await bridgeSetSelectionAnchor(driver, 0, 6);
    await new Promise((r) => setTimeout(r, 250));
    const bg = await driver.executeScript(() => {
      const nodes = document.querySelectorAll('.cm-selectionBackground');
      for (const el of nodes) {
        const b = getComputedStyle(el).backgroundColor;
        if (!b) continue;
        if (b === 'rgba(0, 0, 0, 0)' || b === 'transparent') continue;
        return b;
      }
      return null;
    });
    assert.ok(bg, `expected selection background, got ${bg}`);
    const bad =
      bg === 'rgb(255, 255, 255)' ||
      bg === 'rgba(255, 255, 255, 1)' ||
      /^rgba\(255,\s*255,\s*255,\s*1\)$/.test(bg);
    assert.ok(!bad, `selection must not be pure white on dark UI, got ${bg}`);
  });
});

function untilVisibleFindPanel(driver) {
  return async () => (await driver.findElements(By.css('.find-replace-panel'))).length > 0;
}
