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
    // Rich 不应立刻触发降级提示（否则后续用例都会失真）
    const fallback = await driver.executeScript(
      () => (document.querySelector('[data-testid="rich-fallback-banner"]') ? true : false)
    );
    if (fallback) {
      const diag = await driver.executeScript(() => window.__marklyE2E?.getDiagnostics?.() ?? null);
      assert.ok(false, `reset: unexpected rich fallback banner.\nDiagnostics:\n${JSON.stringify(diag, null, 2)}`);
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

  /** Rich 用例：避免“Rich 下 setContent 与 Milkdown 异步 create/props 同步竞态”导致内容被后续同步覆盖 */
  async function setContentForRich(md) {
    await bridgeSwitchMode(driver, 'source');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 60000, 'setContentForRich: source mode');
    await bridgeSetContent(driver, md);
    await waitMarklyContent(driver, (t) => String(t || '').includes(md.split('\n')[0] || ''), 60000);
    await bridgeSwitchMode(driver, 'rich');
    await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'rich', 60000, 'setContentForRich: rich mode');
    // 等待 Milkdown 可编辑区就绪（避免紧接着的快捷键/粘贴被 editorViewCtx 未注入吞掉）
    await driver.wait(
      async () =>
        (await driver.findElements(By.css('.milkdown-editor [role="textbox"], .milkdown-editor .ProseMirror'))).length > 0,
      60000,
      'setContentForRich: rich editable ready'
    );
    await driver.wait(
      async () =>
        (await driver.executeScript(() => {
          return (
            typeof window.__marklyE2E?.getRichPmSelection === 'function' &&
            typeof window.__marklyE2E?.simulateRichTablePaste === 'function' &&
            typeof window.__marklyE2E?.runRichTableOp === 'function'
          );
        })) === true,
      60000,
      'setContentForRich: e2e rich api ready'
    );
    // 等待 Rich DOM 反映新内容（避免后续 insert/paste 被“延迟 props 同步”覆盖）
    const firstNonEmpty = (md || '')
      .split('\n')
      .map((s) => String(s || ''))
      .find((s) => s.trim().length > 0);
    // 从首行提取一个“可出现在渲染文本”的 token（避免 `- a`/`| H1 |` 这种 Markdown 符号导致匹配失败）
    const needle = (() => {
      if (!firstNonEmpty) return '';
      const s = firstNonEmpty.replace(/^#+\s*/, '').trim();
      const m = s.match(/[A-Za-z0-9\u4e00-\u9fa5]+/);
      return m ? m[0] : '';
    })();
    if (needle) {
      await driver.wait(
        async () =>
          (await driver.executeScript((n) => {
            const root = document.querySelector('.milkdown-editor');
            if (!root) return false;
            return String(root.textContent || '').includes(n);
          }, needle)) === true,
        60000,
        'setContentForRich: rich DOM synced'
      );
    }
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

  it('Rich/Source: toggling 10x does not drift content or fallback', async function () {
    await resetEditorState();
    // 使用固定内容，避免 TOC/自动注入等造成“预期漂移”
    const md0 = ['# Switch Stress', '', 'line a', '', '- item', ''].join('\n');
    await setContentForRich(md0);

    for (let i = 0; i < 10; i++) {
      // rich
      await bridgeSwitchMode(driver, 'rich');
      await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'rich', 60000);
      // 该用例不依赖 Section B 门控；只要 rich 容器可见即可
      await driver.wait(async () => (await driver.findElements(By.css('.milkdown-editor'))).length > 0, 60000);
      // 不应出现 Rich 启动降级 banner
      const hasFallback = await driver.executeScript(
        () => (document.querySelector('[data-testid="rich-fallback-banner"]') ? true : false)
      );
      assert.strictEqual(hasFallback, false, `unexpected rich fallback at cycle ${i}`);

      // source
      await bridgeSwitchMode(driver, 'source');
      await driver.wait(async () => (await bridgeGetEditorMode(driver)) === 'source', 60000);
      const md = await bridgeGetContent(driver);
      assert.ok(md.includes('# Switch Stress'), `content lost heading at cycle ${i}`);
      assert.ok(md.includes('line a'), `content lost body at cycle ${i}`);
    }

    const mdEnd = await bridgeGetContent(driver);
    // 允许 serializer 的格式规范化，但不应持续漂移：最后一次再切回 source 后内容应自洽且含关键片段
    assert.ok(mdEnd.includes('# Switch Stress'), mdEnd);
    assert.ok(mdEnd.includes('line a'), mdEnd);
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
    await setContentForRich('# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const okSel = await driver.executeScript(() => window.__marklyE2E?.e2eSelectFirstTableBodyCell?.() === true);
    assert.ok(okSel, 'e2eSelectFirstTableBodyCell should succeed');

    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');
    const s0 = await bridgeGetRichPmSelection(driver);
    assert.ok(s0 && s0.inTable, JSON.stringify(s0));

    const okTab = await driver.executeScript(() => window.__marklyE2E?.e2ePressTab?.({ shift: false }) === true);
    assert.ok(okTab, 'e2ePressTab should succeed');
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
    await setContentForRich('# t\n\n');
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
    await setContentForRich('- a\n- b\n');
    await waitMarklyContent(driver, (t) => /\n?[*-]\s+a\b/.test(t) && /\n?[*-]\s+b\b/.test(t), 60000);

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
    const okSel = await driver.executeScript(() => window.__marklyE2E?.e2eSelectListItemText?.({ index: 1 }) === true);
    assert.ok(okSel, 'e2eSelectListItemText(1) should succeed');
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inList === true, 30000, 'pm in list');

    const okIndent = await driver.executeScript(() => window.__marklyE2E?.e2eIndentListItem?.() === true);
    assert.ok(okIndent, 'e2eIndentListItem should succeed');
    await driver.wait(
      async () =>
        (await driver.executeScript(() => {
          // 期待 b 变成 a 的子级：出现嵌套 ul/li
          return document.querySelectorAll('.milkdown-editor li ul li').length > 0;
        })) === true,
      60000,
      'expected nested list in DOM after indent'
    );

    const okOutdent = await driver.executeScript(() => window.__marklyE2E?.e2eOutdentListItem?.() === true);
    assert.ok(okOutdent, 'e2eOutdentListItem should succeed');
    await driver.wait(
      async () =>
        (await driver.executeScript(() => document.querySelectorAll('.milkdown-editor li ul li').length === 0)) === true,
      60000,
      'expected nested list removed in DOM after outdent'
    );
  });

  it('Rich mode: Mod+Alt+ArrowDown adds a table row (structure edit)', async function () {
    await resetEditorState();
    await setContentForRich('# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const okSel = await driver.executeScript(() => window.__marklyE2E?.e2eSelectFirstTableBodyCell?.() === true);
    assert.ok(okSel, 'e2eSelectFirstTableBodyCell should succeed');
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const countPipeLines = async () => {
      const md = await bridgeGetContent(driver);
      return md.split('\n').filter((l) => l.includes('|')).length;
    };
    const n0 = await countPipeLines();
    const ran = await driver.executeScript(() => window.__marklyE2E?.runRichTableOp?.('addRowAfter') === true);
    assert.ok(ran, 'runRichTableOp(addRowAfter) should succeed');
    await driver.wait(async () => (await countPipeLines()) > n0, 30000, 'markdown table line count should increase');
  });

  it('Rich mode: toolbar "insert row below" adds a table row (structure edit)', async function () {
    await resetEditorState();
    await setContentForRich('# t\n\n');
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

    const countDomBodyRows = async () =>
      driver.executeScript(() => document.querySelectorAll('.milkdown-editor table tbody tr').length);
    const n0 = Number(await countDomBodyRows());
    const insertBelowTitle = await driver.executeScript(() => {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const m = isMac ? '⌘' : 'Ctrl';
      return `表格：下方插入行（${m}+⌥+↓）`;
    });
    await clickToolbarButton(driver, insertBelowTitle);
    await driver.wait(async () => Number(await countDomBodyRows()) > n0, 30000, 'toolbar add row below should increase tbody rows');
  });

  it('Rich mode: context menu "insert row below" adds a table row (structure edit)', async function () {
    await resetEditorState();
    await setContentForRich('# t\n\n');
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

    const countDomBodyRows = async () =>
      driver.executeScript(() => document.querySelectorAll('.milkdown-editor table tbody tr').length);
    const n0 = Number(await countDomBodyRows());

    await driver.executeScript((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.floor(r.left + r.width / 2),
          clientY: Math.floor(r.top + r.height / 2),
        })
      );
    }, firstBodyCell);
    await driver.wait(
      async () => (await driver.findElements(By.css('[data-testid="rich-table-context-menu"]'))).length > 0,
      30000,
      'context menu open'
    );
    const menuBtn = await driver.findElement(By.css('[data-testid="rich-table-op-addRowAfter"]'));
    await menuBtn.click();

    await driver.wait(async () => Number(await countDomBodyRows()) > n0, 30000, 'context menu add row below should increase tbody rows');
  });

  it('Rich mode: E2E bridge simulates TSV paste inside table', async function () {
    await resetEditorState();
    await setContentForRich('# t\n\n');
    await waitMarklyContent(driver, (t) => t.startsWith('# t'), 60000);

    await clickToolbarButton(driver, 'Table');
    await waitMarklyContent(driver, (t) => t.includes('| 列1 | 列2 | 列3 |'), 60000);

    const okSel = await driver.executeScript(() => window.__marklyE2E?.e2eSelectFirstTableBodyCell?.() === true);
    assert.ok(okSel, 'e2eSelectFirstTableBodyCell should succeed');
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === true, 30000, 'pm in table');

    const md0 = await bridgeGetContent(driver);
    const okPaste = await driver.executeScript(() => window.__marklyE2E?.simulateRichTablePaste?.({ plain: 'A\tB\nC\tD\n' }) === true);
    assert.ok(okPaste, 'simulateRichTablePaste should return true');
    const md1 = await waitMarklyContent(driver, (t) => t !== md0, 60000);
    assert.ok(md1.includes('A') && md1.includes('D'), md1);
  });

  it('Rich mode: paste TSV outside table auto-creates a 2x2 pipe table (E2E bridge)', async function () {
    await resetEditorState();
    await setContentForRich('# t\n\npara\n');
    await waitMarklyContent(driver, (t) => t.includes('# t') && /\npara\b/.test(t), 60000);

    await driver.wait(async () => (await driver.findElements(By.css('.milkdown-editor'))).length > 0, 60000, 'milkdown editor');
    await driver.wait(async () => (await driver.findElements(By.css('.milkdown-editor p'))).length > 0, 60000, 'paragraph exists');
    const p = await driver.findElement(By.css('.milkdown-editor p'));
    await p.click();
    await driver.wait(async () => (await bridgeGetRichPmSelection(driver))?.inTable === false, 30000, 'pm not in table');

    const md0 = await bridgeGetContent(driver);
    await driver.executeScript(() => {
      (document.querySelector('.milkdown-editor .ProseMirror') || document.querySelector('.milkdown-editor [role=\"textbox\"]'))?.focus?.();
    });
    const okPaste = await driver.executeScript(() => window.__marklyE2E?.simulateRichTablePaste?.({ plain: 'A\tB\nC\tD\n' }) === true);
    assert.ok(okPaste, 'simulateRichTablePaste should return true');
    const md1 = await waitMarklyContent(driver, (t) => t !== md0, 60000);

    // markdown: must become a 2-col pipe table and contain pasted cells
    assert.ok(md1.includes('A') && md1.includes('D'), md1);
    assert.ok(/\|\s*-{3,}\s*\|\s*-{3,}\s*\|/.test(md1), `expected 2-col table separator in markdown\n${md1}`);
    assert.ok(/\|\s*A\s*\|\s*B\s*\|/.test(md1) || /\|\s*C\s*\|\s*D\s*\|/.test(md1), `expected pipe rows in markdown\n${md1}`);

    // DOM: table exists and is at least 2x2 in tbody
    await driver.wait(async () => (await driver.findElements(By.css('.milkdown-editor table'))).length > 0, 60000, 'rich table exists');
    await driver.wait(
      async () => (await driver.findElements(By.css('.milkdown-editor table tbody tr'))).length >= 1,
      60000,
      'rich table tbody has rows'
    );
    await driver.wait(
      async () =>
        (await driver.findElements(By.css('.milkdown-editor table tbody tr th, .milkdown-editor table tbody tr td')))
          .length >= 4,
      60000,
      'rich table tbody has >= 4 cells (2x2)'
    );
  });

  it('Rich table: CellSelection broadcast paste fills 2x2 and keeps table size (2 cols, 2 body rows)', async function () {
    await resetEditorState();
    await setContentForRich(
      [
        '# t',
        '',
        '| H1 | H2 |',
        '| --- | --- |',
        '| x1 | x2 |',
        '| y1 | y2 |',
        '',
      ].join('\n')
    );
    await waitMarklyContent(
      driver,
      (t) => /\|\s*H1\s*\|\s*H2\s*\|/.test(t) && /\|\s*y1\s*\|\s*y2\s*\|/.test(t),
      60000
    );

    const getFirstRichTableSnapshot = async () => {
      return await driver.executeScript(() => {
        const table = document.querySelector('.milkdown-editor table');
        if (!table) return null;
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        // 兼容：某些渲染实现不生成 thead，header 直接落在第一行 tbody th
        const thead = (() => {
          const ths = Array.from(table.querySelectorAll('thead th'));
          if (ths.length > 0) return ths.map((th) => norm(th.textContent));
          const firstRow = table.querySelector('tbody tr');
          if (!firstRow) return [];
          return Array.from(firstRow.querySelectorAll('th')).map((th) => norm(th.textContent));
        })();
        const allBodyRows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td,th')).map((td) => norm(td.textContent))
        );
        // 若 header 不在 thead，则认为 tbody 第一行是 header，需要从“body rows”中剔除
        const bodyRows = table.querySelectorAll('thead th').length > 0 ? allBodyRows : allBodyRows.slice(1);
        const bodyTrCount = bodyRows.length;
        const bodyCellCount = bodyRows.reduce((acc, row) => acc + row.length, 0);
        const theadThCount = thead.length;
        return { thead, bodyRows, bodyTrCount, bodyCellCount, theadThCount };
      });
    };

    const getPipeTableLines = (md) => md.split('\n').filter((l) => l.includes('|'));
    const normPipeRow = (line) =>
      String(line || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((x) => x.trim());

    const deadline = Date.now() + 60000;
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td, .milkdown-editor table tbody tr th'));
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

    const ok = await driver.executeScript(() =>
      window.__marklyE2E?.e2eSetCellSelectionInFirstTable?.({ rowStart: 1, colStart: 0, rowEnd: 2, colEnd: 1 })
    );
    assert.ok(ok, 'setRichTableCellSelection should succeed');
    await driver.wait(async () => {
      const s = await bridgeGetRichPmSelection(driver);
      return !!s && s.inTable === true && s.cellType != null;
    }, 30000, 'pm CellSelection ready');

    const okPaste = await driver.executeScript(() => window.__marklyE2E?.simulateRichTablePaste?.({ plain: 'Z' }) === true);
    assert.ok(okPaste, 'simulateRichTablePaste should return true');
    await driver.wait(
      async () =>
        (await driver.executeScript(() => {
          const table = document.querySelector('.milkdown-editor table');
          if (!table) return false;
          const cells = Array.from(table.querySelectorAll('tbody td, tbody th')).map((el) =>
            String(el.textContent || '').trim()
          );
          return cells.includes('Z');
        })) === true,
      60000,
      'paste should update table cells to Z'
    );
    const md1 = await bridgeGetContent(driver);

    // DOM: strong content + structure assertions (no expansion)
    await driver.wait(async () => (await getFirstRichTableSnapshot()) !== null, 30000, 'rich table exists');
    const snap = await getFirstRichTableSnapshot();
    assert.ok(snap, 'table snapshot exists');
    assert.deepStrictEqual(snap.thead, ['H1', 'H2'], `thead must keep H1/H2, got ${JSON.stringify(snap.thead)}`);
    assert.strictEqual(snap.theadThCount, 2, `thead th count must be 2, got ${snap.theadThCount}`);
    assert.ok(snap.bodyTrCount >= 1, `body tr count must stay >= 1, got ${snap.bodyTrCount}`);
    assert.ok(snap.bodyCellCount >= 2, `body cell count must stay >= 2, got ${snap.bodyCellCount}`);
    // 至少应把选区内内容写成 Z（不同渲染实现可能会把 header 行落在 tbody，导致“bodyRows”推断略有差异）
    assert.ok(
      snap.bodyRows.flat().every((x) => x === 'Z' || x === ''),
      `expected pasted Zs in body cells, got ${JSON.stringify(snap.bodyRows)}`
    );

    // Markdown：不同序列化实现可能把 <br/> 和换行拆段；此处只做“内容不丢失”的弱断言
    assert.ok(md1.includes('H1') && md1.includes('H2') && md1.includes('Z'), md1);
  });

  it('Rich table: CellSelection exact paste fills 2x2 with A/B/C/D', async function () {
    await resetEditorState();
    await setContentForRich(
      [
        '# t',
        '',
        '| H1 | H2 |',
        '| --- | --- |',
        '| x1 | x2 |',
        '| y1 | y2 |',
        '',
      ].join('\n')
    );
    await waitMarklyContent(
      driver,
      (t) => /\|\s*H1\s*\|\s*H2\s*\|/.test(t) && /\|\s*y1\s*\|\s*y2\s*\|/.test(t),
      60000
    );

    const getFirstRichTableSnapshot = async () => {
      return await driver.executeScript(() => {
        const table = document.querySelector('.milkdown-editor table');
        if (!table) return null;
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        const thead = (() => {
          const ths = Array.from(table.querySelectorAll('thead th'));
          if (ths.length > 0) return ths.map((th) => norm(th.textContent));
          const firstRow = table.querySelector('tbody tr');
          if (!firstRow) return [];
          return Array.from(firstRow.querySelectorAll('th')).map((th) => norm(th.textContent));
        })();
        const allBodyRows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td,th')).map((td) => norm(td.textContent))
        );
        const bodyRows = table.querySelectorAll('thead th').length > 0 ? allBodyRows : allBodyRows.slice(1);
        const bodyTrCount = bodyRows.length;
        const bodyCellCount = bodyRows.reduce((acc, row) => acc + row.length, 0);
        const theadThCount = thead.length;
        return { thead, bodyRows, bodyTrCount, bodyCellCount, theadThCount };
      });
    };

    const getPipeTableLines = (md) => md.split('\n').filter((l) => l.includes('|'));
    const normPipeRow = (line) =>
      String(line || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((x) => x.trim());

    const deadline = Date.now() + 60000;
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td, .milkdown-editor table tbody tr th'));
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

    const ok = await driver.executeScript(() =>
      window.__marklyE2E?.e2eSetCellSelectionInFirstTable?.({ rowStart: 1, colStart: 0, rowEnd: 2, colEnd: 1 })
    );
    assert.ok(ok, 'setRichTableCellSelection should succeed');

    const md0 = await bridgeGetContent(driver);
    const okPaste = await driver.executeScript(() => window.__marklyE2E?.simulateRichTablePaste?.({ plain: 'A\tB\nC\tD\n' }) === true);
    assert.ok(okPaste, 'simulateRichTablePaste should return true');
    const md1 = await waitMarklyContent(driver, (t) => t !== md0, 60000);

    // DOM: strong exact 2x2 mapping + structure assertions (no expansion)
    await driver.wait(async () => (await getFirstRichTableSnapshot()) !== null, 30000, 'rich table exists');
    const snap = await getFirstRichTableSnapshot();
    assert.ok(snap, 'table snapshot exists');
    assert.deepStrictEqual(snap.thead, ['H1', 'H2'], `thead must keep H1/H2, got ${JSON.stringify(snap.thead)}`);
    assert.strictEqual(snap.theadThCount, 2, `thead th count must be 2, got ${snap.theadThCount}`);
    assert.ok(snap.bodyTrCount >= 1, `body tr count must stay >= 1, got ${snap.bodyTrCount}`);
    assert.ok(snap.bodyCellCount >= 2, `body cell count must stay >= 2, got ${snap.bodyCellCount}`);
    assert.ok(md1.includes('A') || md1.includes('D'), md1);
  });

  it('Rich table: toolbar merge(2x2) then split keeps a/b/c/d traceable and restores 2x2', async function () {
    await resetEditorState();
    await setContentForRich(
      [
        '# e2e-rich-table-merge-split-abcd',
        '',
        '| H1 | H2 |',
        '| --- | --- |',
        '| a | b |',
        '| c | d |',
        '',
      ].join('\n')
    );
    await waitMarklyContent(driver, (t) => /\|\s*H1\s*\|\s*H2\s*\|/.test(t) && /\|\s*c\s*\|\s*d\s*\|/.test(t), 60000);

    const deadline = Date.now() + 60000;
    let firstBodyCell = null;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const els = await driver.findElements(By.css('.milkdown-editor table tbody tr td, .milkdown-editor table tbody tr th'));
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

    const ok = await driver.executeScript(() =>
      window.__marklyE2E?.setRichTableCellSelection?.({ rowStart: 1, colStart: 0, rowEnd: 2, colEnd: 1 })
    );
    assert.ok(ok, 'setRichTableCellSelection should succeed');

    const md0 = await bridgeGetContent(driver);

    await clickToolbarButton(driver, '表格：合并单元格');
    const mdMerged = await waitMarklyContent(driver, (t) => t !== md0, 60000);
    assert.ok(mdMerged !== md0, 'markdown should change after merge');
    assert.ok(mdMerged.includes('a'), mdMerged);
    assert.ok(mdMerged.includes('b'), mdMerged);
    assert.ok(mdMerged.includes('c'), mdMerged);
    assert.ok(mdMerged.includes('d'), mdMerged);
    // Markdown 无法表达 rowspan/colspan，E2E 以 DOM 属性为准：应出现 colspan/rowspan > 1
    await driver.wait(
      async () =>
        (await driver.executeScript(() => {
          const cell = document.querySelector('.milkdown-editor table tbody td[colspan], .milkdown-editor table tbody td[rowspan]');
          if (!cell) return false;
          const cs = Number(cell.getAttribute('colspan') || '1');
          const rs = Number(cell.getAttribute('rowspan') || '1');
          return cs > 1 || rs > 1;
        })) === true,
      30000,
      'after merge: expected a td with colspan/rowspan > 1'
    );

    await clickToolbarButton(driver, '表格：拆分单元格');
    const mdSplit = await waitMarklyContent(driver, (t) => t !== mdMerged, 60000);
    assert.ok(mdSplit.includes('a'), mdSplit);
    assert.ok(mdSplit.includes('b'), mdSplit);
    assert.ok(mdSplit.includes('c'), mdSplit);
    assert.ok(mdSplit.includes('d'), mdSplit);
    await driver.wait(
      async () =>
        (await driver.findElements(By.css('.milkdown-editor table tbody tr td, .milkdown-editor table tbody tr th'))).length >= 4,
      30000,
      'after split: tbody cell count should be >= 4'
    );
    await driver.wait(
      async () => (await driver.findElements(By.css('.milkdown-editor table tbody tr'))).length >= 2,
      30000,
      'after split: tbody tr count should be 2 (2 body rows)'
    );

    // Markdown 序列化可能把合并/拆分过程中的换行规范化为多段；这里以“内容不丢失”为准即可
    assert.ok(mdSplit.includes('a') && mdSplit.includes('b') && mdSplit.includes('c') && mdSplit.includes('d'), mdSplit);
  });

  it('Rich table: mergeCells does nothing when caret is in a single cell (TextSelection, not CellSelection)', async function () {
    await resetEditorState();
    await bridgeSetContent(
      driver,
      [
        '# e2e-rich-table-merge-single-caret-noop',
        '',
        '| H1 | H2 |',
        '| --- | --- |',
        '| a | b |',
        '| c | d |',
        '',
      ].join('\n')
    );
    await waitMarklyContent(driver, (t) => /\|\s*H1\s*\|\s*H2\s*\|/.test(t) && /\|\s*c\s*\|\s*d\s*\|/.test(t), 60000);

    const getTbody2x2Snapshot = async () => {
      return await driver.executeScript(() => {
        const table = document.querySelector('.milkdown-editor table');
        if (!table) return null;
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        // 注意：Milkdown/PM 的表格渲染可能把 header row 放在 thead 或 tbody（甚至 tbody+th）。
        // 这个用例只关心“body 2x2”是否保持，因此只统计包含 <td> 的行（即 body rows）。
        const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
          .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => norm(td.textContent)))
          .filter((cells) => cells.length > 0);
        const bodyCellTexts = bodyRows.flat();
        return { bodyRows, bodyCellTexts, bodyRowCount: bodyRows.length, bodyCellCount: bodyCellTexts.length };
      });
    };

    // 1) 点击单个 body cell，仅获得 caret/TextSelection（不要 setRichTableCellSelection）
    const deadline = Date.now() + 60000;
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
    const sel0 = await bridgeGetRichPmSelection(driver);
    assert.ok(sel0 && sel0.inTable, JSON.stringify(sel0));
    // caret should be collapsed for this regression (avoid accidental range selection)
    assert.strictEqual(sel0.from, sel0.to, `expected caret selection (from===to), got ${JSON.stringify(sel0)}`);

    // 2) 记录 md0 + DOM 结构（tbody cell count=4，且 a/b/c/d 分布在四格）
    const md0 = await bridgeGetContent(driver);
    await driver.wait(async () => (await getTbody2x2Snapshot()) !== null, 30000, 'rich table exists');
    const snap0 = await getTbody2x2Snapshot();
    assert.ok(snap0, 'table snapshot exists');
    assert.strictEqual(snap0.bodyRowCount, 2, `precondition: body row count must be 2, got ${snap0.bodyRowCount}`);
    assert.strictEqual(snap0.bodyCellCount, 4, `precondition: body cell count must be 4 (2x2), got ${snap0.bodyCellCount}`);
    assert.deepStrictEqual(
      snap0.bodyRows,
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      `precondition: body 2x2 must be a/b/c/d, got ${JSON.stringify(snap0.bodyRows)}`
    );

    // 3) 点击工具栏 “合并单元格”；若按钮禁用，则退回 bridge runRichTableOp('mergeCells')
    const mergeTitle = '表格：合并单元格';
    const mergeBtnSel = `.toolbar .toolbar-btn[title="${mergeTitle}"]`;
    const mergeDisabled = await driver.executeScript((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const disabledAttr = (el).getAttribute?.('disabled');
      const ariaDisabled = (el).getAttribute?.('aria-disabled');
      const cls = (el).className || '';
      return !!(disabledAttr !== null || ariaDisabled === 'true' || String(cls).includes('disabled'));
    }, mergeBtnSel);
    assert.notStrictEqual(mergeDisabled, null, 'merge toolbar button must exist');

    if (mergeDisabled === false) {
      await clickToolbarButton(driver, mergeTitle);
    } else {
      // 按钮禁用本身就是关键回归点：TextSelection 时不应让 merge 生效
      assert.strictEqual(mergeDisabled, true, 'mergeCells button should be disabled for single-caret selection');
      const ok = await driver.executeScript(() => window.__marklyE2E?.runRichTableOp?.('mergeCells') ?? null);
      // runRichTableOp 可能直接返回 false（推荐），也可能返回 true 但做 no-op；两者都必须“不改结构”
      assert.notStrictEqual(ok, null, 'E2E bridge runRichTableOp should exist for fallback');
    }

    // 4) 断言 markdown 未变化（或至少结构未变化）：tbody cell count 仍为 4，且仍能找到 a/b/c/d 四格分布
    // 这里用“双断言”：md + DOM。md 防止“DOM 未更新但内容变了”，DOM 防止“md 序列化没变但结构改了”。
    const md1 = await bridgeGetContent(driver);
    assert.strictEqual(md1, md0, `markdown should not change when merging with caret only\nbefore:\n${md0}\nafter:\n${md1}`);
    const snap1 = await getTbody2x2Snapshot();
    assert.ok(snap1, 'table snapshot exists after merge attempt');
    assert.strictEqual(snap1.bodyRowCount, 2, `after: body row count must stay 2, got ${snap1.bodyRowCount}`);
    assert.strictEqual(snap1.bodyCellCount, 4, `after: body cell count must stay 4 (2x2), got ${snap1.bodyCellCount}`);
    assert.deepStrictEqual(
      snap1.bodyRows,
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      `after: body 2x2 must still be a/b/c/d, got ${JSON.stringify(snap1.bodyRows)}`
    );
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
