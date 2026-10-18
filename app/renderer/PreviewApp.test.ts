import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { headingNodeId, parseHeadings } from '@wv/shared/outline';
import PreviewApp from './PreviewApp.vue';
import { installVsCodeShim } from './vscodeShim';
import {
  RELOAD_MISSING_TIP,
  RELOAD_OK_TIP,
  RELOAD_TIP_OK_MS,
  RELOAD_UNREADABLE_TIP,
} from '../electron/reloadResult';
import { SELECTION_COPY_TYPE } from '../electron/selectionCopy';
import { APP_RADIUS } from '../chromeRadius';
import { PLACE_ANCHOR, PLACE_READ, PLACE_RESTORE, scrollTopForSource, measureSourceBox } from '../electron/viewPlace';
import type { ElectronAppBridge } from './electronBridge';
import previewAppSource from './PreviewApp.vue?raw';
import fileTreeSource from './FileTree.vue?raw';

let mounted: { app: App; el: HTMLElement } | null = null;

function install(bridge: Partial<ElectronAppBridge>): void {
  (window as unknown as { electron: ElectronAppBridge }).electron = bridge;
  installVsCodeShim();
}

/** 空闲时的复制图标：后一张圆角矩形在左上露出，前一张在右下，两者错开。 */
function expectCopySheets(copy: Element): void {
  const icon = copy.querySelector('.tab-copy-icon');
  expect(icon).not.toBeNull();
  const rects = [...icon!.querySelectorAll('rect')];
  expect(rects).toHaveLength(1);
  const rect = rects[0]!;
  const rx = Number(rect.getAttribute('rx'));
  const x = Number(rect.getAttribute('x'));
  const y = Number(rect.getAttribute('y'));
  const w = Number(rect.getAttribute('width'));
  const h = Number(rect.getAttribute('height'));
  expect(rx).toBeGreaterThan(0.5);
  expect(w).toBeGreaterThan(4);
  expect(h).toBeGreaterThan(4);

  const d = icon!.querySelector('path')?.getAttribute('d') ?? '';
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let px = 0;
  let py = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const touch = () => {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const read = () => Number(tokens[i++]);
    if (cmd === 'M') {
      px = read();
      py = read();
      touch();
    } else if (cmd === 'V') {
      py = read();
      touch();
    } else if (cmd === 'h') {
      px += read();
      touch();
    } else if (cmd === 'c') {
      read();
      read();
      read();
      read();
      px += read();
      py += read();
      touch();
    }
  }
  expect(minX).toBeLessThan(x - 1);
  expect(minY).toBeLessThan(y - 1);
  expect(x + w).toBeGreaterThan(maxX + 1);
  expect(y + h).toBeGreaterThan(maxY + 1);
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

/** 切源码会先问预览现在看到哪，等它回答或超时。 */
async function settle(): Promise<void> {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 150));
  await flush();
}

function mount(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(PreviewApp);
  app.mount(el);
  mounted = { app, el };
  return el;
}

/** 模拟主进程推消息（useVSCode 监听 window message，data 即消息体） */
function pushMsg(type: string, payload: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: { type, payload } }));
}

/** jsdom 无 DragEvent，用普通事件贴 dataTransfer */
function dropFiles(files: Array<{ path?: string; name?: string }>): void {
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files, dropEffect: 'none' } });
  document.dispatchEvent(ev);
}

beforeEach(() => {
  install({
    postMessage: vi.fn(),
    onPush: vi.fn(() => () => undefined),
    storeGet: vi.fn(() => undefined),
    storeSet: vi.fn(),
    tabsState: vi.fn(() => ({
      tabs: [{ id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' }],
      activeId: 't1',
    })),
    getAppearance: vi.fn(() => ({ theme: 'auto', fontFamily: '', fontSize: 14, prefersDark: false })),
    openPath: vi.fn(async () => '/x.md'),
    openSettingsTab: vi.fn(async () => undefined),
    listRecentFiles: vi.fn(async () => []),
    exportDocument: vi.fn(async () => ({ ok: true, path: '/tmp/a.pdf', format: 'pdf' })),
  });
});

afterEach(() => {
  mounted?.app.unmount();
  mounted?.el.remove();
  mounted = null;
  delete (window as unknown as { electron?: ElectronAppBridge }).electron;
  delete (window as unknown as { vscode?: unknown }).vscode;
});

describe('PreviewApp 顶栏与大纲', () => {
  it('有标题时目录画在正文里面，没有标题时目录消失', async () => {
    const el = mount();
    await flush();

    pushMsg('CONTENT_UPDATE', { content: '# 标题一\n\n## 小节\n\n正文' });
    await flush();
    const outline = el.querySelector('.preview-area .doc-outline');
    expect(outline).not.toBeNull();
    expect(el.querySelector('.markly-app > .doc-outline')).toBeNull();
    expect(outline!.textContent).toContain('标题一');
    expect(outline!.textContent).toContain('小节');

    pushMsg('CONTENT_UPDATE', { content: '只有正文，没有任何标题' });
    await flush();
    expect(el.querySelector('.doc-outline')).toBeNull();
    expect(el.querySelector('.doc-body')).not.toBeNull();
  });

  it('点目录里的标题会让正文滚到那一节', async () => {
    const el = mount();
    await flush();
    const markdown = '# 标题一\n\n## 小节\n\n正文';
    pushMsg('CONTENT_UPDATE', { content: markdown });
    pushMsg('PREVIEW_HTML', { html: '<h2 id="小节">小节</h2>' });
    await flush();

    const frame = el.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: { postMessage: post } });
    const row = [...el.querySelectorAll('.doc-outline-row')].find((node) => node.textContent?.includes('小节'));
    expect(row).toBeTruthy();
    (row as HTMLElement).click();

    const headings = parseHeadings(markdown);
    expect(post).toHaveBeenCalledWith(
      { type: 'SCROLL_TO_HEADING', headingId: headingNodeId(headings[1], 2) },
      '*'
    );
  });

  it('收起目录后列表消失，并记住这个选择', async () => {
    const storeSet = vi.fn();
    (window as unknown as { electron: ElectronAppBridge }).electron.storeSet = storeSet;
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '# 标题一\n\n正文' });
    await flush();

    (el.querySelector('.doc-outline-toggle') as HTMLButtonElement).click();
    await flush();
    expect(el.querySelector('.doc-outline-list')).toBeNull();
    expect(el.querySelector('.doc-outline.collapsed')).not.toBeNull();
    expect(storeSet).toHaveBeenCalledWith('outlineCollapsed', true);
  });

  it('打开按钮在文件树上方，标签从文件树右侧开始排', async () => {
    const el = mount();
    await flush();

    const rail = el.querySelector('.open-rail') as HTMLElement;
    const bar = el.querySelector('.tab-bar') as HTMLElement;
    expect(rail.querySelector('.open-split')).not.toBeNull();
    expect(bar.querySelector('.open-split')).toBeNull();
    // 标签栏里第一块就是标签条，左边不再放打开按钮
    expect(bar.firstElementChild!.classList.contains('tab-strip')).toBe(true);
    expect(el.querySelector('.tab.active')).not.toBeNull();

    const reload = el.querySelector('.tab-reload') as HTMLButtonElement;
    const copy = el.querySelector('.tab-copy') as HTMLElement;
    const source = el.querySelector('.tab-source') as HTMLButtonElement;
    const exp = el.querySelector('.export-split') as HTMLElement;
    const settings = el.querySelector('.tab-settings') as HTMLElement;
    const plus = el.querySelector('.tab-new') as HTMLElement;
    expect(reload).not.toBeNull();
    expect(copy).not.toBeNull();
    expect(source).not.toBeNull();
    expect(exp).not.toBeNull();
    expect(settings).not.toBeNull();
    // 刷新、复制、源码、导出、设置依次排在 "+" 前面
    expect(reload.nextElementSibling).toBe(copy);
    expect(reload.textContent?.trim()).toBe('刷新');
    expect(reload.getAttribute('aria-label')).toBe('重新加载文档');
    expect(reload.disabled).toBe(false);
    expect(copy.nextElementSibling).toBe(source);
    expect(source.nextElementSibling).toBe(exp);
    expect(exp.nextElementSibling).toBe(settings);
    expect(settings.nextElementSibling).toBe(plus);
    expect(source.textContent?.trim()).toBe('源码');
    expect(source.getAttribute('aria-label')).toBe('查看源码');
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(source.disabled).toBe(false);
    expect(settings.textContent?.trim()).toBe('设置');
    // 图标按钮：不再带「复制」文字。空闲时是两个错开的圆角矩形，不是字符方块。
    expect(copy.textContent?.trim()).not.toContain('复制');
    expect(copy.textContent).not.toContain('⧉');
    expect(copy.querySelector('.tab-copy-mark')).toBeNull();
    expectCopySheets(copy);
    // 默认不展开格式菜单
    expect(el.querySelector('.export-menu')).toBeNull();
  });

  it('复制成功后按钮变成打勾，一会儿恢复成复制图标', async () => {
    vi.useFakeTimers();
    try {
      const copyToClipboard = vi.fn(async () => true);
      (window as unknown as { electron: ElectronAppBridge }).electron.copyToClipboard = copyToClipboard;

      const el = mount();
      await flush();
      const copy = el.querySelector('.tab-copy') as HTMLButtonElement;
      copy.click();
      await flush();

      expect(copyToClipboard).toHaveBeenCalledTimes(1);
      expect(copy.classList.contains('is-copied')).toBe(true);
      expect(copy.querySelector('.tab-copy-mark')).not.toBeNull();
      expect(copy.querySelector('.tab-copy-icon')).toBeNull();
      expect(copy.getAttribute('aria-label')).toContain('已复制');

      const firstMark = copy.querySelector('.tab-copy-mark');
      copy.click();
      await flush();
      expect(copyToClipboard).toHaveBeenCalledTimes(2);
      expect(copy.querySelector('.tab-copy-mark')).not.toBe(firstMark);

      await vi.advanceTimersByTimeAsync(1600);
      await nextTick();
      expect(copy.classList.contains('is-copied')).toBe(false);
      expect(copy.querySelector('.tab-copy-mark')).toBeNull();
      expectCopySheets(copy);
      expect(copy.getAttribute('aria-label')).toContain('复制全文');
    } finally {
      vi.useRealTimers();
    }
  });

  it('复制失败时不显示打勾，提示失败', async () => {
    (window as unknown as { electron: ElectronAppBridge }).electron.copyToClipboard = vi.fn(async () => false);

    const el = mount();
    await flush();
    const copy = el.querySelector('.tab-copy') as HTMLButtonElement;
    copy.click();
    await flush();

    expect(copy.classList.contains('is-copied')).toBe(false);
    expect(copy.classList.contains('is-failed')).toBe(true);
    expect(copy.querySelector('.tab-copy-mark')).toBeNull();
    expectCopySheets(copy);
    expect(copy.getAttribute('aria-label')).toBe('复制失败');
  });

  it('导出按钮悬停和点击都会展开 PDF / HTML，点选后真正调用导出', async () => {
    const el = mount();
    await flush();

    const split = el.querySelector('.export-split') as HTMLElement;
    const button = el.querySelector('.tab-export') as HTMLButtonElement;
    split.dispatchEvent(new MouseEvent('mouseenter'));
    await flush();
    expect(el.querySelector('.export-menu')).not.toBeNull();
    expect(el.querySelector('[data-format="pdf"]')?.textContent).toContain('PDF');
    expect(el.querySelector('[data-format="html"]')?.textContent).toContain('HTML');

    // 没钉住时，鼠标离开就收起
    vi.useFakeTimers();
    split.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.advanceTimersByTimeAsync(200);
    expect(el.querySelector('.export-menu')).toBeNull();
    vi.useRealTimers();

    // 点击同样展开，并钉住：离开后仍在
    button.click();
    await flush();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.title).toBe('');
    expect(el.querySelector('.export-menu')).not.toBeNull();
    vi.useFakeTimers();
    split.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.advanceTimersByTimeAsync(200);
    expect(el.querySelector('.export-menu')).not.toBeNull();
    vi.useRealTimers();

    (el.querySelector('[data-format="html"]') as HTMLElement).click();
    await flush();
    expect(electronStub('exportDocument')).toHaveBeenCalledWith('html');
    expect(el.querySelector('.export-menu')).toBeNull();
    expect(button.title).toContain('已导出 HTML');

    // 再点一次 PDF
    button.click();
    await flush();
    (el.querySelector('[data-format="pdf"]') as HTMLElement).click();
    await flush();
    expect(electronStub('exportDocument')).toHaveBeenLastCalledWith('pdf');
  });

  it('导出菜单贴住导出按钮，打开时不让系统提示盖住', async () => {
    const el = mount();
    await flush();
    const button = el.querySelector('.tab-export') as HTMLButtonElement;
    expect(button.title).toContain('导出');
    button.click();
    await flush();

    const menu = el.querySelector('.export-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelector('[data-format="pdf"]')?.textContent).toContain('PDF');
    expect(menu.querySelector('[data-format="html"]')?.textContent).toContain('HTML');
    const menuRule = previewAppSource.match(/\.export-menu\s*\{[^}]+\}/)?.[0] ?? '';
    expect(menuRule).toMatch(/top:\s*100%/);
    expect(menuRule).toMatch(/right:\s*0/);
    expect(menuRule).not.toMatch(/calc\s*\(/);
    expect(menuRule).toMatch(/border-radius:\s*var\(--app-radius-md\)/);
    const style = getComputedStyle(menu);
    if (style.top && style.top !== 'auto') {
      expect(style.top === '100%' || style.top === '0px').toBe(true);
      expect(style.top.includes('+')).toBe(false);
      expect(parseFloat(style.top)).not.toBe(4);
    }
    expect(button.title).toBe('');
    expect(button.getAttribute('aria-label')).toContain('导出');

    button.click();
    await flush();
    expect(el.querySelector('.export-menu')).toBeNull();
    expect(button.title).toContain('导出');
  });

  it('点击导出按钮后再次点击收起；点到外面也收起', async () => {
    const el = mount();
    await flush();
    const button = el.querySelector('.tab-export') as HTMLButtonElement;
    button.click();
    await flush();
    expect(el.querySelector('.export-menu')).not.toBeNull();

    button.click();
    await flush();
    expect(el.querySelector('.export-menu')).toBeNull();

    button.click();
    await flush();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    expect(el.querySelector('.export-menu')).toBeNull();
  });

  it('设置页不能导出', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 's', kind: 'settings', title: '设置', filePath: '' }],
      activeId: 's',
    });
    const el = mount();
    await flush();
    const button = el.querySelector('.tab-export') as HTMLButtonElement;
    const settings = el.querySelector('.tab-settings') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(settings.disabled).toBe(false);
    expect(settings.classList.contains('active')).toBe(true);
    (el.querySelector('.export-split') as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
    button.click();
    await flush();
    expect(el.querySelector('.export-menu')).toBeNull();
    expect(electronStub('exportDocument')).not.toHaveBeenCalled();
  });

  it('最近打开菜单点空白处收起，点菜单内部不收起', async () => {
    const el = mount();
    await flush();

    (el.querySelector('.open-caret') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.recent-menu')).not.toBeNull();

    // 菜单里的空白（标题区）不算“外面”
    (el.querySelector('.recent-title') as HTMLElement).dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    );
    await flush();
    expect(el.querySelector('.recent-menu')).not.toBeNull();

    // 预览 iframe 盖不住父页面的点击：全屏透明层接住空白点击
    const dismiss = el.querySelector('.recent-dismiss') as HTMLElement;
    expect(dismiss).not.toBeNull();
    dismiss.click();
    await flush();
    expect(el.querySelector('.recent-menu')).toBeNull();
    expect(el.querySelector('.recent-dismiss')).toBeNull();

    // 侧栏、预览区这类“外面”的按下也要收起（不依赖遮罩那一下 click）
    (el.querySelector('.open-caret') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.recent-menu')).not.toBeNull();
    el.querySelector('.preview-area')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(el.querySelector('.recent-menu')).toBeNull();
  });

  it('最近打开菜单在焦点进入预览时收起', async () => {
    const el = mount();
    await flush();
    pushMsg('PREVIEW_HTML', { html: '<p>正文</p>' });
    await flush();

    (el.querySelector('.open-caret') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.recent-menu')).not.toBeNull();

    // 普通失焦（焦点没进预览）不收起
    window.dispatchEvent(new Event('blur'));
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.querySelector('.recent-menu')).not.toBeNull();

    const frame = el.querySelector('.preview-frame') as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    frame.focus();
    window.dispatchEvent(new Event('blur'));
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.querySelector('.recent-menu')).toBeNull();
  });

  it('设置在导出旁边，最近打开里不再出现，点击进设置页', async () => {
    const el = mount();
    await flush();

    const settings = el.querySelector('.tab-settings') as HTMLButtonElement;
    const exp = el.querySelector('.export-split') as HTMLElement;
    expect(settings).not.toBeNull();
    expect(exp.nextElementSibling).toBe(settings);
    expect(el.querySelector('.open-rail .tab-settings')).toBeNull();

    (el.querySelector('.open-caret') as HTMLElement).click();
    await flush();
    const menu = el.querySelector('.recent-menu')!;
    expect(menu.querySelector('.recent-settings-btn')).toBeNull();
    expect(menu.textContent).not.toContain('设置');

    settings.click();
    await flush();
    expect(electronStub('openSettingsTab')).toHaveBeenCalled();
    expect(el.querySelector('.recent-menu')).toBeNull();
  });

  it('把 Markdown / JSON 拖进界面自动打开，其它类型忽略', async () => {
    mount();
    await flush();

    dropFiles([
      { path: '/docs/a.md', name: 'a.md' },
      { path: '/docs/readme.txt', name: 'readme.txt' },
      { path: '/docs/b.markdown', name: 'b.markdown' },
      { path: '/docs/data.json', name: 'data.json' },
      { path: '/docs/rows.jsonl', name: 'rows.jsonl' },
    ]);
    await flush();

    const openPath = electronStub('openPath');
    expect(openPath.mock.calls.map((c) => c[0])).toEqual([
      '/docs/a.md',
      '/docs/b.markdown',
      '/docs/data.json',
      '/docs/rows.jsonl',
    ]);
  });

  it('刷新成功后顶部提示一会儿消失，正文换成新的', async () => {
    vi.useFakeTimers();
    try {
      const reloadDocument = vi.fn(async () => {
        pushMsg('CONTENT_UPDATE', { content: '# 新的标题\n\n新正文' });
        return { ok: true };
      });
      (window as unknown as { electron: ElectronAppBridge }).electron.reloadDocument = reloadDocument;
      const el = mount();
      await flush();
      pushMsg('CONTENT_UPDATE', { content: '# 旧标题\n\n旧正文' });
      pushMsg('PREVIEW_HTML', { html: '<h1>旧标题</h1>' });
      await flush();

      (el.querySelector('.tab-reload') as HTMLButtonElement).click();
      await flush();

      expect(reloadDocument).toHaveBeenCalledTimes(1);
      expect(el.querySelector('.reload-tip')?.textContent).toBe(RELOAD_OK_TIP);
      expect(el.querySelector('.reload-tip')?.classList.contains('is-ok')).toBe(true);
      expect(el.querySelector('.doc-outline')?.textContent).toContain('新的标题');

      await vi.advanceTimersByTimeAsync(RELOAD_TIP_OK_MS);
      await nextTick();
      expect(el.querySelector('.reload-tip')).toBeNull();
      expect(el.querySelector('.doc-outline')?.textContent).toContain('新的标题');
    } finally {
      vi.useRealTimers();
    }
  });

  it('文件不在时不改正文，顶部提示留着', async () => {
    vi.useFakeTimers();
    try {
      const reloadDocument = vi.fn(async () => ({ ok: false, reason: 'missing' }));
      (window as unknown as { electron: ElectronAppBridge }).electron.reloadDocument = reloadDocument;
      const el = mount();
      await flush();
      pushMsg('CONTENT_UPDATE', { content: '# 旧标题\n\n旧正文' });
      pushMsg('PREVIEW_HTML', { html: '<h1>旧标题</h1><p>旧正文</p>' });
      await flush();

      (el.querySelector('.tab-reload') as HTMLButtonElement).click();
      await flush();

      expect(el.querySelector('.reload-tip')?.textContent).toBe(RELOAD_MISSING_TIP);
      expect(el.querySelector('.reload-tip')?.classList.contains('is-missing')).toBe(true);
      expect(el.querySelector('.doc-outline')?.textContent).toContain('旧标题');
      expect(el.querySelector('iframe')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(RELOAD_TIP_OK_MS * 3);
      await nextTick();
      expect(el.querySelector('.reload-tip')?.textContent).toBe(RELOAD_MISSING_TIP);
      expect(el.querySelector('.doc-outline')?.textContent).toContain('旧标题');
    } finally {
      vi.useRealTimers();
    }
  });

  it('读失败时也不清空，换到别的标签时这条提示让开', async () => {
    let emit: ((view: unknown) => void) | undefined;
    (window as unknown as { electron: ElectronAppBridge }).electron.onTabsChanged = (handler) => {
      emit = handler;
      return () => {
        emit = undefined;
      };
    };
    const both = [
      { id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
      { id: 't2', kind: 'doc', title: 'b.md', filePath: '/docs/b.md' },
    ];
    electronStub('tabsState').mockReturnValue({ tabs: both, activeId: 't1' });
    const reloadDocument = vi.fn(async () => ({ ok: false, reason: 'unreadable' }));
    (window as unknown as { electron: ElectronAppBridge }).electron.reloadDocument = reloadDocument;
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '# 还在\n\n正文' });
    await flush();

    (el.querySelector('.tab-reload') as HTMLButtonElement).click();
    await flush();
    expect(el.querySelector('.reload-tip')?.textContent).toBe(RELOAD_UNREADABLE_TIP);
    expect(el.querySelector('.doc-outline')?.textContent).toContain('还在');

    emit?.({ tabs: both, activeId: 't2' });
    pushMsg('CONTENT_UPDATE', { content: '# 另一篇' });
    await flush();
    expect(el.querySelector('.reload-tip')).toBeNull();
    expect(el.querySelector('.doc-outline')?.textContent).toContain('另一篇');

    emit?.({ tabs: both, activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: '# 还在\n\n正文' });
    await flush();
    expect(el.querySelector('.reload-tip')?.textContent).toBe(RELOAD_UNREADABLE_TIP);
  });

  it('空白页和设置页不能刷新', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 't1', kind: 'doc', title: '新标签页', filePath: '' }],
      activeId: 't1',
    });
    const reloadDocument = vi.fn(async () => ({ ok: true }));
    (window as unknown as { electron: ElectronAppBridge }).electron.reloadDocument = reloadDocument;
    const el = mount();
    await flush();
    const blank = el.querySelector('.tab-reload') as HTMLButtonElement;
    expect(blank.disabled).toBe(true);
    expect(blank.getAttribute('aria-label')).toBe('还没有文件可刷新');
    blank.click();
    await flush();
    expect(reloadDocument).not.toHaveBeenCalled();
    expect(el.querySelector('.reload-tip')).toBeNull();

    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 's', kind: 'settings', title: '设置', filePath: '' }],
      activeId: 's',
    });
    mounted?.app.unmount();
    mounted?.el.remove();
    const again = mount();
    await flush();
    const settings = again.querySelector('.tab-reload') as HTMLButtonElement;
    expect(again.querySelector('.settings-page')).not.toBeNull();
    expect(settings.disabled).toBe(true);
    expect(settings.getAttribute('aria-label')).toBe('设置页不能刷新');
  });

  it('点源码看到 Markdown 原文，目录先让开，再点回到预览', async () => {
    const el = mount();
    await flush();
    const markdown = '# 标题一\n\n正文';
    pushMsg('CONTENT_UPDATE', { content: markdown });
    pushMsg('PREVIEW_HTML', { html: '<h1>标题一</h1><p>正文</p>' });
    await flush();
    expect(el.querySelector('.doc-outline')).not.toBeNull();
    expect(el.querySelector('iframe')).not.toBeNull();

    const source = el.querySelector('.tab-source') as HTMLButtonElement;
    expect(source.textContent?.trim()).toBe('源码');
    source.click();
    await settle();
    expect(source.getAttribute('aria-pressed')).toBe('true');
    expect(source.textContent?.trim()).toBe('渲染');
    expect(source.getAttribute('aria-label')).toBe('渲染');
    expect(el.querySelector('.doc-outline')).toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
    const view = el.querySelector('.source-view') as HTMLElement;
    expect(view.textContent).toBe(markdown);
    expect(view.style.fontFamily).toBe('');
    const family = getComputedStyle(view).fontFamily;
    expect(family.toLowerCase()).toContain('monospace');
    expect(family).not.toContain('Noto Sans');
    expect(el.querySelector('.source-note')).toBeNull();

    source.click();
    await settle();
    expect(source.textContent?.trim()).toBe('源码');
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('.source-view')).toBeNull();
    expect(el.querySelector('iframe')).not.toBeNull();
    expect(el.querySelector('.doc-outline')).not.toBeNull();
  });

  it('JSON 源码按缩进排开，解析不了就显示原文', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 't1', kind: 'doc', title: 'a.json', filePath: '/docs/a.json' }],
      activeId: 't1',
    });
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '{"a":1,"b":[2,3]}' });
    await flush();
    const source = el.querySelector('.tab-source') as HTMLButtonElement;
    source.click();
    await settle();
    expect(source.textContent?.trim()).toBe('渲染');
    expect(el.querySelector('.source-view')?.textContent).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}'
    );

    pushMsg('CONTENT_UPDATE', { content: '{broken' });
    await flush();
    expect(el.querySelector('.source-view')?.textContent).toBe('{broken');
    expect(el.querySelector('.source-note')?.textContent).toBe('这份 JSON 没法排成缩进，下面是原文。');
  });

  it('JSONL 源码把每一行排开，坏行原样留下', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 't1', kind: 'doc', title: 'rows.jsonl', filePath: '/docs/rows.jsonl' }],
      activeId: 't1',
    });
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '{"id":1}\n\nnope\n{"n":[1]}\n' });
    await flush();
    (el.querySelector('.tab-source') as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('.source-view')?.textContent).toBe(
      '{\n  "id": 1\n}\n\nnope\n\n{\n  "n": [\n    1\n  ]\n}'
    );
    expect(el.querySelector('.source-note')?.textContent).toBe('有的行没法排成缩进，那些行按原文留下。');
  });

  it('设置页不能查看源码', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 's', kind: 'settings', title: '设置', filePath: '' }],
      activeId: 's',
    });
    const el = mount();
    await flush();
    const source = el.querySelector('.tab-source') as HTMLButtonElement;
    expect(el.querySelector('.settings-page')).not.toBeNull();
    expect(source.disabled).toBe(true);
    expect(source.getAttribute('aria-label')).toBe('设置页没有源码');
    source.click();
    await flush();
    expect(el.querySelector('.source-view')).toBeNull();
  });

  it('每个标签各自记住源码或预览', async () => {
    let emit: ((view: unknown) => void) | undefined;
    (window as unknown as { electron: ElectronAppBridge }).electron.onTabsChanged = (handler) => {
      emit = handler;
      return () => {
        emit = undefined;
      };
    };
    electronStub('tabsState').mockReturnValue({
      tabs: [
        { id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
        { id: 't2', kind: 'doc', title: 'rows.jsonl', filePath: '/docs/rows.jsonl' },
      ],
      activeId: 't1',
    });
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '# 标题\n\n{"a":1}' });
    await flush();
    (el.querySelector('.tab-source') as HTMLButtonElement).click();
    await settle();
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('渲染');
    expect(el.querySelector('.source-view')?.textContent).toBe('# 标题\n\n{"a":1}');

    const both = [
      { id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
      { id: 't2', kind: 'doc', title: 'rows.jsonl', filePath: '/docs/rows.jsonl' },
    ];
    emit?.({ tabs: both, activeId: 't2' });
    pushMsg('CONTENT_UPDATE', { content: '{"a":1}\nnot-json\n' });
    await flush();
    expect(el.querySelector('.source-view')).toBeNull();

    (el.querySelector('.tab-source') as HTMLButtonElement).click();
    await settle();
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('渲染');
    expect(el.querySelector('.source-view')?.textContent).toBe('{\n  "a": 1\n}\n\nnot-json');

    emit?.({ tabs: both, activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: '# 标题\n\n{"a":1}' });
    await flush();
    expect(el.querySelector('.source-view')?.textContent).toBe('# 标题\n\n{"a":1}');
    expect(el.querySelector('.tab-source')?.getAttribute('aria-pressed')).toBe('true');

    const settings = { id: 's', kind: 'settings', title: '设置', filePath: '' };
    emit?.({ tabs: [...both, settings], activeId: 's' });
    await flush();
    expect(el.querySelector('.source-view')).toBeNull();
    expect((el.querySelector('.tab-source') as HTMLButtonElement).disabled).toBe(true);

    emit?.({ tabs: [...both, settings], activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: '# 标题\n\n{"a":1}' });
    await flush();
    expect(el.querySelector('.source-view')?.textContent).toBe('# 标题\n\n{"a":1}');

    emit?.({ tabs: [both[1]], activeId: 't2' });
    pushMsg('CONTENT_UPDATE', { content: '{"a":1}\nnot-json\n' });
    await flush();
    expect(el.querySelector('.source-view')?.textContent).toBe('{\n  "a": 1\n}\n\nnot-json');

    emit?.({ tabs: both, activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: '# 标题\n\n{"a":1}' });
    await flush();
    expect(el.querySelector('.source-view')).toBeNull();
    expect(el.querySelector('.tab-source')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('切到源码后按钮变成渲染，视口仍停在原来那一段', async () => {
    const lines = ['# 开头', '', '第一段在最上面。'];
    for (let i = 0; i < 30; i += 1) lines.push(`填充行 ${i}，用来把后面的内容推远。`);
    const later = '靠近文末的这一节还在看';
    lines.push(`## ${later}`);
    lines.push('后面还有一句。');
    const markdown = lines.join('\n');

    let emit: ((view: unknown) => void) | undefined;
    (window as unknown as { electron: ElectronAppBridge }).electron.onTabsChanged = (handler) => {
      emit = handler;
      return () => {
        emit = undefined;
      };
    };
    const both = [
      { id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
      { id: 't2', kind: 'doc', title: 'b.md', filePath: '/docs/b.md' },
    ];
    electronStub('tabsState').mockReturnValue({ tabs: both, activeId: 't1' });

    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: markdown });
    pushMsg('PREVIEW_HTML', { html: `<h1>开头</h1><p>第一段在最上面。</p><h2>${later}</h2>` });
    await flush();

    const frame = el.querySelector('iframe') as HTMLIFrameElement;
    const sent: unknown[] = [];
    const frameWin = {
      postMessage(data: unknown) {
        sent.push(data);
        const rec = data as { type?: string };
        if (rec?.type === PLACE_READ) {
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: PLACE_ANCHOR, snippet: later, ratio: 0 },
              source: frameWin as unknown as MessageEventSource,
            })
          );
        }
      },
    };
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: frameWin });

    const button = el.querySelector('.tab-source') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('源码');
    button.click();
    await settle();

    expect(button.textContent?.trim()).toBe('渲染');
    expect(sent.some((item) => (item as { type?: string }).type === PLACE_READ)).toBe(true);
    const pre = el.querySelector('.source-view') as HTMLPreElement;
    const expected = scrollTopForSource(markdown, { snippet: later, ratio: 0 }, measureSourceBox(pre));
    expect(pre.scrollTop).toBe(expected);
    expect(pre.scrollTop).toBeGreaterThan(measureSourceBox(pre).lineHeight * 10);
    expect(pre.textContent).toContain(later);
    expect(getComputedStyle(pre).fontFamily.toLowerCase()).toContain('monospace');

    const restores: unknown[] = [];
    const previewWin = {
      postMessage(data: unknown) {
        restores.push(data);
      },
    };
    const contentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        return previewWin as unknown as Window;
      },
    });
    try {
      button.click();
      await settle();
      expect(button.textContent?.trim()).toBe('源码');
      const restore = restores.find((item) => (item as { type?: string }).type === PLACE_RESTORE) as
        | { snippet?: string }
        | undefined;
      expect(restore?.snippet).toContain(later);
      expect(restore?.snippet?.startsWith('开头')).toBe(false);
      expect(restore?.snippet?.startsWith('第一段')).toBe(false);
    } finally {
      if (contentWindow) Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', contentWindow);
    }

    const frameBack = el.querySelector('iframe') as HTMLIFrameElement;
    const frameWinBack = {
      postMessage(data: unknown) {
        const rec = data as { type?: string };
        if (rec?.type === PLACE_READ) {
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: PLACE_ANCHOR, snippet: later, ratio: 0 },
              source: frameWinBack as unknown as MessageEventSource,
            })
          );
        }
      },
    };
    Object.defineProperty(frameBack, 'contentWindow', { configurable: true, value: frameWinBack });
    button.click();
    await settle();
    expect(button.textContent?.trim()).toBe('渲染');
    const again = el.querySelector('.source-view') as HTMLPreElement;
    expect(again.scrollTop).toBeGreaterThan(measureSourceBox(again).lineHeight * 10);

    emit?.({ tabs: both, activeId: 't2' });
    pushMsg('CONTENT_UPDATE', { content: '# 另一篇\n\n正文' });
    await flush();
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('源码');
    expect(el.querySelector('.source-view')).toBeNull();

    emit?.({ tabs: both, activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: markdown });
    await flush();
    const back = el.querySelector('.source-view') as HTMLPreElement;
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('渲染');
    expect(back.scrollTop).toBe(scrollTopForSource(markdown, { snippet: later, ratio: 0 }, measureSourceBox(back)));
    expect(back.scrollTop).toBeGreaterThan(0);
  });

  it('空标签上有打开；已有文档的标签不出现这颗按钮', async () => {
    const doc = mount();
    await flush();
    expect(doc.querySelector('.blank-open')).toBeNull();
    mounted?.app.unmount();
    mounted?.el.remove();

    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 'blank', kind: 'doc', title: '新标签页', filePath: '' }],
      activeId: 'blank',
    });
    const openFile = vi.fn(async () => '/docs/note.md');
    const openPath = vi.fn(async () => '/docs/note.md');
    const newTab = vi.fn(async () => undefined);
    const bridge = (window as unknown as { electron: ElectronAppBridge }).electron;
    bridge.openFile = openFile;
    bridge.openPath = openPath;
    bridge.newTab = newTab;
    bridge.fileTreeRoot = async () => '/docs';
    bridge.listFileTree = async (dir: string) => {
      if (dir === '/docs') {
        return {
          dir,
          entries: [{ name: 'note.md', path: '/docs/note.md', kind: 'file' as const }],
          error: '',
        };
      }
      return { dir, entries: [], error: '' };
    };

    const el = mount();
    await flush();
    const blank = el.querySelector('.blank-open') as HTMLButtonElement;
    expect(blank).not.toBeNull();
    expect(blank.textContent?.trim()).toBe('打开');
    expect(blank.classList.contains('chrome-btn')).toBe(true);
    expect(blank.classList.contains('file-up')).toBe(false);
    expect(previewAppSource).toMatch(/\.chrome-btn\s*\{[^}]*border-radius:\s*var\(--app-radius-sm\)/);
    expect(previewAppSource).not.toMatch(/\.blank-open\s*\{[^}]*border-radius/);
    expect(fileTreeSource).toMatch(/\.file-up,\s*\n\.file-toggle\s*\{[^}]*border-radius:\s*var\(--app-radius-xxs\)/);
    const shell = el.querySelector('.markly-app') as HTMLElement;
    expect(shell.style.getPropertyValue('--app-radius-sm')).toBe(APP_RADIUS.sm);
    expect(shell.style.getPropertyValue('--app-radius-xxs')).toBe(APP_RADIUS.xxs);
    expect(APP_RADIUS.sm).toBe('12px');
    expect(APP_RADIUS.xxs).toBe('6px');

    blank.click();
    await flush();
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(newTab).not.toHaveBeenCalled();

    const row = el.querySelector('.tree-row[data-path="/docs/note.md"]') as HTMLButtonElement;
    expect(row).not.toBeNull();
    row.click();
    await flush();
    expect(openPath).toHaveBeenCalledWith('/docs/note.md');
    expect(newTab).not.toHaveBeenCalled();
  });

  it('打开 JSON 时不拿正文里的 # 当目录', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 't1', kind: 'doc', title: 'a.json', filePath: '/docs/a.json' }],
      activeId: 't1',
    });
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '# 不是标题\n{"a":1}' });
    await flush();
    expect(el.querySelector('.doc-outline')).toBeNull();
    expect(el.querySelector('.doc-body')).not.toBeNull();
  });

  it('预览框以外的选区消息不会写入剪贴板', async () => {
    const copySelection = vi.fn(async () => true);
    (window as unknown as { electron: ElectronAppBridge }).electron.copySelection = copySelection;
    const el = mount();
    await flush();
    pushMsg('PREVIEW_HTML', { html: '<div class="content"><p>你好世界</p></div>' });
    await flush();

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: SELECTION_COPY_TYPE, text: '你好世界' } })
    );
    await flush();
    expect(copySelection).not.toHaveBeenCalled();
    expect(el.querySelector('.selection-toast')).toBeNull();
  });

  it('预览框里选中正文后写入剪贴板并提示已复制', async () => {
    const copySelection = vi.fn(async () => true);
    (window as unknown as { electron: ElectronAppBridge }).electron.copySelection = copySelection;
    const el = mount();
    await flush();
    pushMsg('PREVIEW_HTML', { html: '<div class="content"><p>你好世界</p></div>' });
    await flush();
    const frame = el.querySelector('iframe');
    expect(frame?.contentWindow).toBeTruthy();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: SELECTION_COPY_TYPE, text: '你好世界' },
        source: frame?.contentWindow,
      })
    );
    await flush();
    expect(copySelection).toHaveBeenCalledWith({ text: '你好世界' });
    expect(el.querySelector('.selection-toast')?.textContent).toBe('已复制');
  });
});

function electronStub<K extends keyof ElectronAppBridge>(key: K): ReturnType<typeof vi.fn> {
  return (window as unknown as { electron: Record<string, ReturnType<typeof vi.fn>> }).electron[
    key as string
  ];
}
