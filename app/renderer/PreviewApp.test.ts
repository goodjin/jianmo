import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createApp, nextTick, type App } from 'vue';
import { headingNodeId, parseHeadings } from '@wv/shared/outline';
import { chromeRadiusStyle } from '../chromeRadius';
import PreviewApp from './PreviewApp.vue';
import previewAppSource from './PreviewApp.vue?raw';
import { installVsCodeShim } from './vscodeShim';
import {
  RELOAD_MISSING_TIP,
  RELOAD_OK_TIP,
  RELOAD_TIP_OK_MS,
  RELOAD_UNREADABLE_TIP,
} from '../electron/reloadResult';
import { SELECTION_COPY_TYPE } from '../electron/selectionCopy';
import { formatDocumentSource } from '../electron/sourceText';
import { APP_RADIUS } from '../chromeRadius';
import { PLACE_ANCHOR, PLACE_READ, PLACE_RESTORE, scrollTopForSource, measureSourceBox } from '../electron/viewPlace';
import type { ElectronAppBridge } from './electronBridge';

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

async function openActions(el: ParentNode): Promise<void> {
  (el.querySelector('.actions-split') as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
  await flush();
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
    // 标签条在左，加号跟着最后一张。源码和操作在最右。
    expect(bar.firstElementChild!.classList.contains('tab-scroller')).toBe(true);
    expect(el.querySelector('.tab.active')).not.toBeNull();
    const strip = el.querySelector('.tab-strip')!;
    const plus = strip.querySelector('.tab-new') as HTMLElement;
    expect(strip.querySelector('.tab')!.nextElementSibling).toBe(plus);
    expect(el.querySelector('.tab-undo')).toBeNull();
    expect(el.querySelector('.tab-redo')).toBeNull();
    expect(el.querySelector('.tab-save')).toBeNull();
    const source = el.querySelector('.tab-source') as HTMLButtonElement;
    const actions = el.querySelector('.tab-actions') as HTMLButtonElement;
    expect(source).not.toBeNull();
    expect(source.querySelector('.chrome-glyph')).not.toBeNull();
    expect(source.textContent?.trim()).toBe('源码');
    expect(source.getAttribute('aria-label')).toBe('查看源码');
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(source.disabled).toBe(false);
    expect(source.nextElementSibling).toBe(el.querySelector('.actions-split'));
    expect(actions.textContent).toContain('操作');
    expect(actions.querySelectorAll('.actions-dots circle')).toHaveLength(3);
    expect(el.querySelector('.actions-menu')).toBeNull();
    expect(el.querySelector('.tab-export')).toBeNull();

    await openActions(el);
    const reload = el.querySelector('.tab-reload') as HTMLButtonElement;
    const edit = el.querySelector('.tab-edit') as HTMLButtonElement;
    const settings = el.querySelector('.tab-settings') as HTMLElement;
    const copy = el.querySelector('.doc-body .doc-copy') as HTMLElement;
    expect(reload.textContent?.trim()).toBe('刷新');
    expect(reload.getAttribute('aria-label')).toBe('重新加载文档');
    expect(reload.disabled).toBe(false);
    expect(reload.nextElementSibling).toBe(edit);
    expect(el.querySelector('.actions-menu .tab-copy')).toBeNull();
    expect(edit.textContent?.trim()).toBe('编辑');
    expect(edit.nextElementSibling?.getAttribute('data-format')).toBe('pdf');
    expect(el.querySelector('[data-format="html"]')?.textContent?.trim()).toBe('导出 HTML');
    expect(el.querySelector('[data-format="html"]')?.nextElementSibling).toBe(settings);
    expect(settings.textContent?.trim()).toBe('设置');
    expect(copy.getAttribute('aria-label')).toContain('复制全文');
    expect(copy.querySelector('.tab-copy-mark')).toBeNull();
    expectCopySheets(copy);

    const chrome = rail.querySelector('.file-tree-chrome') as HTMLElement;
    expect(rail.querySelector('.open-split')!.nextElementSibling).toBe(chrome);
    expect(el.querySelector('.file-head')).toBeNull();
    expect(el.querySelector('.file-head-title')).toBeNull();
    const up = chrome.querySelector('.file-up') as HTMLButtonElement;
    const treeRefresh = chrome.querySelector('.file-icon-btn:not(.file-up)') as HTMLButtonElement;
    const toggle = chrome.querySelector('.file-toggle') as HTMLButtonElement;
    expect(up.querySelector('.file-up-icon path')).not.toBeNull();
    expect(up.textContent).not.toContain('↑');
    expect(up.getAttribute('aria-label')).toBe('上一级目录');
    expect(treeRefresh.textContent?.trim()).toBe('刷新');
    expect(treeRefresh.getAttribute('aria-label')).toBe('刷新目录树');
    expect(toggle.textContent?.trim()).toBe('‹');
    expect(toggle.getAttribute('aria-label')).toBe('收起文件');
    expect(el.querySelector('.file-tree .file-head')).toBeNull();
  });

  it('收起文件后侧栏只留展开按钮，目录操作回到打开旁边', async () => {
    const storeSet = vi.fn();
    (window as unknown as { electron: ElectronAppBridge }).electron.storeSet = storeSet;
    const el = mount();
    await flush();

    const toggle = el.querySelector('.file-tree-chrome .file-toggle') as HTMLButtonElement;
    toggle.click();
    await flush();

    expect(el.querySelector('.file-tree.collapsed')).not.toBeNull();
    expect(el.querySelector('.tree')).toBeNull();
    expect(el.querySelector('.file-head')).toBeNull();
    expect(el.querySelector('.file-tree-chrome .file-up')).toBeNull();
    expect(el.querySelector('.file-tree-chrome .file-icon-btn')).toBeNull();
    const collapsedToggle = el.querySelector('.file-tree-chrome .file-toggle') as HTMLButtonElement;
    expect(collapsedToggle.textContent?.trim()).toBe('›');
    expect(collapsedToggle.getAttribute('aria-label')).toBe('展开文件');
    expect(storeSet).toHaveBeenCalledWith('fileTreeCollapsed', true);
    // 操作还在标签栏最右边，不跟目录按钮混在一起
    expect(el.querySelector('.tab-bar .tab-actions')).not.toBeNull();

    collapsedToggle.click();
    await flush();
    expect(el.querySelector('.file-tree.collapsed')).toBeNull();
    expect(el.querySelector('.file-tree-chrome .file-up')).not.toBeNull();
    expect(el.querySelector('.file-tree-chrome .file-toggle')!.textContent?.trim()).toBe('‹');
    expect(storeSet).toHaveBeenCalledWith('fileTreeCollapsed', false);
  });

  it('打开旁边的上一级和刷新目录会作用到文件树', async () => {
    const listFileTree = vi.fn(async (dir: string) => ({ dir, entries: [], error: '' }));
    const setFileTreeRoot = vi.fn(async (dir: string) => dir);
    const electron = (window as unknown as { electron: ElectronAppBridge }).electron;
    electron.listFileTree = listFileTree;
    electron.setFileTreeRoot = setFileTreeRoot;
    electron.fileTreeRoot = async () => '/home/me';
    electron.tabsState = vi.fn(() => ({
      tabs: [{ id: 't1', kind: 'doc', title: 'readme.md', filePath: '/home/me/readme.md' }],
      activeId: 't1',
    }));
    const el = mount();
    await flush();

    const up = el.querySelector('.file-tree-chrome .file-up') as HTMLButtonElement;
    const refresh = el.querySelector('.file-tree-chrome .file-icon-btn:not(.file-up)') as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    expect(refresh.disabled).toBe(false);

    const before = listFileTree.mock.calls.length;
    refresh.click();
    await flush();
    expect(listFileTree.mock.calls.length).toBeGreaterThan(before);
    expect(listFileTree).toHaveBeenCalledWith('/home/me');

    up.click();
    await flush();
    expect(setFileTreeRoot).toHaveBeenCalledWith('/home');
    expect(el.querySelector('.file-root')!.textContent).toBe('home');
  });

  it('窄图标按钮用更小的圆角，同一排的文字按钮仍用按钮圆角', async () => {
    const css = previewAppSource.match(/<style>([\s\S]*?)<\/style>/);
    expect(css).not.toBeNull();
    const style = document.createElement('style');
    style.textContent = css![1];
    document.head.appendChild(style);
    const el = mount();
    await flush();

    const radius = (selector: string) =>
      getComputedStyle(el.querySelector(selector)!).borderRadius;
    const height = (selector: string) =>
      getComputedStyle(el.querySelector(selector)!).height;

    try {
      expect(radius('.file-up')).toBe('var(--app-radius-xxs)');
      expect(radius('.file-toggle')).toBe('var(--app-radius-xxs)');
      expect(radius('.file-icon-btn:not(.file-up)')).toBe('var(--app-radius-sm)');
      expect(chromeRadiusStyle['--app-radius-xxs']).toBe('6px');
      expect(chromeRadiusStyle['--app-radius-sm']).toBe('12px');
      expect(height('.file-up')).toBe('32px');
      expect(height('.file-toggle')).toBe('32px');
      expect(height('.file-icon-btn:not(.file-up)')).toBe('32px');
      const shaft = el.querySelector('.file-up-icon path') as SVGPathElement;
      expect(Number.parseFloat(getComputedStyle(shaft).strokeWidth)).toBeGreaterThan(2);
    } finally {
      style.remove();
    }
  });

  it('复制成功后按钮变成打勾，一会儿恢复成复制图标', async () => {
    vi.useFakeTimers();
    try {
      const copyToClipboard = vi.fn(async () => true);
      (window as unknown as { electron: ElectronAppBridge }).electron.copyToClipboard = copyToClipboard;

      const el = mount();
      await flush();
      const copy = el.querySelector('.doc-body .doc-copy') as HTMLButtonElement;
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
    const copy = el.querySelector('.doc-body .doc-copy') as HTMLButtonElement;
    copy.click();
    await flush();

    expect(copy.classList.contains('is-copied')).toBe(false);
    expect(copy.classList.contains('is-failed')).toBe(true);
    expect(copy.querySelector('.tab-copy-mark')).toBeNull();
    expectCopySheets(copy);
    expect(copy.getAttribute('aria-label')).toBe('复制失败');
  });

  it('操作菜单悬停和点击都会展开，导出 PDF 和 HTML 分列，点选后真正调用导出', async () => {
    const el = mount();
    await flush();

    const split = el.querySelector('.actions-split') as HTMLElement;
    const button = el.querySelector('.tab-actions') as HTMLButtonElement;
    expect(el.querySelector('.tab-export')).toBeNull();
    split.dispatchEvent(new MouseEvent('mouseenter'));
    await flush();
    expect(el.querySelector('.actions-menu')).not.toBeNull();
    expect(el.querySelector('[data-format="pdf"]')?.textContent?.trim()).toBe('导出 PDF');
    expect(el.querySelector('[data-format="html"]')?.textContent?.trim()).toBe('导出 HTML');

    vi.useFakeTimers();
    split.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.advanceTimersByTimeAsync(200);
    expect(el.querySelector('.actions-menu')).toBeNull();
    vi.useRealTimers();

    button.click();
    await flush();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.title).toBe('');
    expect(el.querySelector('.actions-menu')).not.toBeNull();
    vi.useFakeTimers();
    split.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.advanceTimersByTimeAsync(200);
    expect(el.querySelector('.actions-menu')).not.toBeNull();
    vi.useRealTimers();

    (el.querySelector('[data-format="html"]') as HTMLElement).click();
    await flush();
    expect(electronStub('exportDocument')).toHaveBeenCalledWith('html');
    expect(el.querySelector('.actions-menu')).toBeNull();
    expect(button.title).toContain('已导出 HTML');

    button.click();
    await flush();
    (el.querySelector('[data-format="pdf"]') as HTMLElement).click();
    await flush();
    expect(electronStub('exportDocument')).toHaveBeenLastCalledWith('pdf');
  });

  it('操作菜单贴住按钮，打开时不让系统提示盖住', async () => {
    const el = mount();
    await flush();
    const button = el.querySelector('.tab-actions') as HTMLButtonElement;
    expect(button.title).toBe('操作');
    expect(button.querySelectorAll('.actions-dots circle')).toHaveLength(3);
    button.click();
    await flush();

    const menu = el.querySelector('.actions-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelector('[data-format="pdf"]')?.textContent?.trim()).toBe('导出 PDF');
    expect(menu.querySelector('[data-action="edit"]')?.textContent?.trim()).toBe('编辑');
    expect(button.textContent).toContain('操作');
    expect(button.textContent).not.toContain('导出');
    const itemRule = previewAppSource.match(/\.action-item\s*\{[^}]+\}/)?.[0] ?? '';
    expect(itemRule).toMatch(/white-space:\s*nowrap/);
    const actionRule = previewAppSource.match(/\.tab-actions\s*\{[^}]+\}/)?.[0] ?? '';
    expect(actionRule).toMatch(/width:\s*100%/);
    expect(actionRule).not.toMatch(/min-width/);
    const splitRule = previewAppSource.match(/\.actions-split\s*\{[^}]+\}/)?.[0] ?? '';
    expect(splitRule).toMatch(/grid-template-columns:\s*max-content/);
    const sizer = [...el.querySelectorAll('.actions-sizer span')].map((node) => node.textContent?.trim());
    const items = [...menu.querySelectorAll('.action-item')].map((node) => node.textContent?.trim());
    expect(sizer).toEqual(items);
    expect(sizer).toContain('导出 HTML');
    const copyRule = previewAppSource.match(/\.doc-copy\s*\{[^}]+\}/)?.[0] ?? '';
    expect(copyRule).toMatch(/position:\s*absolute/);
    expect(copyRule).toMatch(/top:\s*12px/);
    expect(copyRule).toMatch(/right:\s*12px/);
    const menuRule = previewAppSource.match(/\.actions-menu\s*\{[^}]+\}/)?.[0] ?? '';
    expect(menuRule).toMatch(/top:\s*calc\(100% - 1px\)/);
    expect(menuRule).toMatch(/left:\s*0/);
    expect(menuRule).toMatch(/right:\s*0/);
    expect(menuRule).not.toMatch(/max-content/);
    expect(menuRule).toMatch(/border-top:\s*0/);
    expect(menuRule).toMatch(/border-radius:\s*0 0 var\(--app-radius-sm\) var\(--app-radius-sm\)/);
    const joined = previewAppSource.match(/\.actions-split:has\(\.actions-menu\) \.tab-actions,\s*\.actions-split:has\(\.actions-menu\) \.tab-actions:hover\s*\{[^}]+\}/)?.[0] ?? '';
    expect(joined).toMatch(/border-radius:\s*var\(--app-radius-sm\) var\(--app-radius-sm\) 0 0/);
    expect(joined).toMatch(/border-bottom-color:\s*var\(--markly-background/);
    expect(button.title).toBe('');
    expect(button.getAttribute('aria-label')).toBe('操作');

    button.click();
    await flush();
    expect(el.querySelector('.actions-menu')).toBeNull();
    expect(button.title).toBe('操作');
  });

  it('点击操作按钮后再次点击收起；点到外面也收起', async () => {
    const el = mount();
    await flush();
    const button = el.querySelector('.tab-actions') as HTMLButtonElement;
    button.click();
    await flush();
    expect(el.querySelector('.actions-menu')).not.toBeNull();

    button.click();
    await flush();
    expect(el.querySelector('.actions-menu')).toBeNull();

    button.click();
    await flush();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    expect(el.querySelector('.actions-menu')).toBeNull();
  });

  it('设置页不能导出，菜单里的设置仍可点', async () => {
    electronStub('tabsState').mockReturnValue({
      tabs: [{ id: 's', kind: 'settings', title: '设置', filePath: '' }],
      activeId: 's',
    });
    const el = mount();
    await flush();
    await openActions(el);
    const pdf = el.querySelector('[data-format="pdf"]') as HTMLButtonElement;
    const settings = el.querySelector('.tab-settings') as HTMLButtonElement;
    expect(pdf.disabled).toBe(true);
    expect(el.querySelector('.doc-copy')).toBeNull();
    expect((el.querySelector('[data-action="edit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(settings.disabled).toBe(false);
    expect(settings.classList.contains('active')).toBe(true);
    pdf.click();
    await flush();
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

  it('设置在操作菜单里，最近打开里不再出现，点击进设置页', async () => {
    const el = mount();
    await flush();
    await openActions(el);

    const settings = el.querySelector('.tab-settings') as HTMLButtonElement;
    expect(settings).not.toBeNull();
    expect(el.querySelector('.actions-menu')!.contains(settings)).toBe(true);
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

      await openActions(el);
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

      await openActions(el);
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

    await openActions(el);
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
    await openActions(el);
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
    await openActions(again);
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
    expect(source.textContent?.trim()).toBe('预览');
    expect(source.getAttribute('aria-pressed')).toBe('true');
    expect(source.getAttribute('aria-label')).toBe('预览');
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
    expect(source.getAttribute('aria-label')).toBe('查看源码');
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
    expect(source.textContent?.trim()).toBe('预览');
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
    expect(source.textContent?.trim()).toBe('源码');
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
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('预览');
    expect(el.querySelector('.source-view')?.textContent).toBe('# 标题\n\n{"a":1}');

    const both = [
      { id: 't1', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
      { id: 't2', kind: 'doc', title: 'rows.jsonl', filePath: '/docs/rows.jsonl' },
    ];
    emit?.({ tabs: both, activeId: 't2' });
    pushMsg('CONTENT_UPDATE', { content: '{"a":1}\nnot-json\n' });
    await flush();
    expect(el.querySelector('.source-view')).toBeNull();
    expect(el.querySelector('.tab-source')?.textContent?.trim()).toBe('源码');

    (el.querySelector('.tab-source') as HTMLButtonElement).click();
    await settle();
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('预览');
    expect(el.querySelector('.source-view')?.textContent).toBe('{\n  "a": 1\n}\n\nnot-json');

    emit?.({ tabs: both, activeId: 't1' });
    pushMsg('CONTENT_UPDATE', { content: '# 标题\n\n{"a":1}' });
    await flush();
    expect(el.querySelector('.source-view')?.textContent).toBe('# 标题\n\n{"a":1}');
    expect(el.querySelector('.tab-source')?.textContent?.trim()).toBe('预览');
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
    expect(el.querySelector('.tab-source')?.textContent?.trim()).toBe('源码');
    expect(el.querySelector('.tab-source')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('切到源码后按钮变成预览，视口仍停在原来那一段', async () => {
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

    expect(button.textContent?.trim()).toBe('预览');
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
    expect(button.textContent?.trim()).toBe('预览');
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
    expect((el.querySelector('.tab-source') as HTMLButtonElement).textContent?.trim()).toBe('预览');
    expect(back.scrollTop).toBe(scrollTopForSource(markdown, { snippet: later, ratio: 0 }, measureSourceBox(back)));
    expect(back.scrollTop).toBeGreaterThan(0);
  });

  it('新标签页放简介，不再放打开按钮；已有文档的标签也不出现简介', async () => {
    const doc = mount();
    await flush();
    expect(doc.querySelector('.blank-open')).toBeNull();
    expect(doc.querySelector('.welcome-title')).toBeNull();
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
    const blankPage = el.querySelector('.blank-page') as HTMLElement;
    expect(blankPage).not.toBeNull();
    expect(blankPage.querySelector('.blank-open')).toBeNull();
    expect(blankPage.querySelector('.welcome-title')?.textContent).toBe('Markly');
    expect(blankPage.textContent).toContain('干净、好读的文档查看器');
    expect(blankPage.textContent).toContain('也可以把文件拖进窗口');
    expect(previewAppSource).toMatch(/\.blank-page\s*\{[^}]*justify-content:\s*flex-start/);
    const pageStyle = getComputedStyle(blankPage);
    if (pageStyle.justifyContent) {
      expect(pageStyle.justifyContent).toBe('flex-start');
    }
    expect(previewAppSource).toMatch(/\.chrome-btn\s*\{[^}]*border-radius:\s*var\(--app-radius-sm\)/);
    expect(previewAppSource).toMatch(/\.file-up,\s*\n\.file-toggle\s*\{[^}]*border-radius:\s*var\(--app-radius-xxs\)/);
    const shell = el.querySelector('.markly-app') as HTMLElement;
    expect(shell.style.getPropertyValue('--app-radius-sm')).toBe(APP_RADIUS.sm);
    expect(shell.style.getPropertyValue('--app-radius-xxs')).toBe(APP_RADIUS.xxs);
    expect(APP_RADIUS.sm).toBe('12px');
    expect(APP_RADIUS.xxs).toBe('6px');
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

describe('原文编辑', () => {
  function bridge(): ElectronAppBridge {
    return (window as unknown as { electron: ElectronAppBridge }).electron;
  }

  it('默认没有撤销和保存；编辑 JSON 用原文，源码仍是排版', async () => {
    const raw = '{"a":1}\r\n';
    bridge().tabsState = vi.fn(() => ({
      tabs: [{ id: 't1', kind: 'doc', title: 'a.json', filePath: '/docs/a.json', dirty: false }],
      activeId: 't1',
    }));
    bridge().settleEdits = vi.fn(async () => 'clean');
    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: raw });
    await flush();

    expect(el.querySelector('.tab-undo')).toBeNull();
    expect(el.querySelector('.tab-redo')).toBeNull();
    expect(el.querySelector('.tab-save')).toBeNull();
    expect(el.querySelector('.cm-editor')).toBeNull();

    await openActions(el);
    (el.querySelector('.tab-edit') as HTMLButtonElement).click();
    await flush();

    const editor = EditorView.findFromDOM(el.querySelector('.cm-editor')!);
    const shown = editor.state.sliceDoc();
    expect(shown.replace(/\r\n/g, '\n')).toBe(raw.replace(/\r\n/g, '\n'));
    expect(shown).not.toBe(formatDocumentSource(raw, 'a.json'));
    expect(el.querySelector('.source-note')?.textContent).toContain('正在编辑文件原文');
    expect((el.querySelector('.tab-undo') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('.tab-undo') as HTMLButtonElement).querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.tab-undo')?.getAttribute('aria-label')).toBe('回退');
    expect((el.querySelector('.tab-redo') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('.tab-redo')?.getAttribute('aria-label')).toBe('重做');
    expect((el.querySelector('.tab-save') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('.tab-source .chrome-glyph')).not.toBeNull();

    await openActions(el);
    (el.querySelector('.tab-edit') as HTMLButtonElement).click();
    await flush();
    expect(el.querySelector('.tab-save')).toBeNull();
    expect(bridge().settleEdits).toHaveBeenCalled();

    (el.querySelector('.tab-source') as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('.source-view')?.textContent).toBe(formatDocumentSource(raw, 'a.json'));
    expect(el.querySelector('.cm-editor')).toBeNull();
  });

  it('换到别的标签再回来，撤销仍能退回这一份，保存会写盘', async () => {
    let onTabs: ((view: unknown) => void) | undefined;
    const saveDocument = vi.fn(async () => ({ ok: true, path: '/docs/a.json' }));
    const raw = '{"a":1}';
    bridge().tabsState = vi.fn(() => ({
      tabs: [
        { id: 't1', kind: 'doc', title: 'a.json', filePath: '/docs/a.json', dirty: false },
        { id: 't2', kind: 'doc', title: 'b.md', filePath: '/docs/b.md', dirty: false },
      ],
      activeId: 't1',
    }));
    bridge().onTabsChanged = (handler) => {
      onTabs = handler;
      return () => undefined;
    };
    bridge().settleEdits = vi.fn(async () => 'clean');
    bridge().saveDocument = saveDocument;

    const el = mount();
    await flush();
    pushMsg('CONTENT_UPDATE', { content: raw });
    await flush();
    await openActions(el);
    (el.querySelector('.tab-edit') as HTMLButtonElement).click();
    await flush();

    const editor = EditorView.findFromDOM(el.querySelector('.cm-editor')!);
    editor.dispatch({ changes: { from: raw.length, insert: ' ' } });
    expect(editor.state.doc.toString()).toBe('{"a":1} ');

    const both = [
      { id: 't1', kind: 'doc', title: 'a.json', filePath: '/docs/a.json', dirty: true },
      { id: 't2', kind: 'doc', title: 'b.md', filePath: '/docs/b.md', dirty: false },
    ];
    onTabs?.({ tabs: both, activeId: 't2' });
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '# B' });
    await flush();
    expect(el.querySelector('.cm-editor')).toBeNull();
    expect(el.querySelector('.tab-undo')).toBeNull();

    onTabs?.({ tabs: both, activeId: 't1' });
    await flush();
    pushMsg('CONTENT_UPDATE', { content: '{"a":1} ' });
    await flush();

    const back = EditorView.findFromDOM(el.querySelector('.cm-editor')!);
    expect(back.state.doc.toString()).toBe('{"a":1} ');
    expect(el.querySelectorAll('.cm-editor')).toHaveLength(1);
    (el.querySelector('.tab-undo') as HTMLButtonElement).click();
    expect(back.state.doc.toString()).toBe(raw);

    onTabs?.({ tabs: both, activeId: 't1' });
    await flush();
    expect((el.querySelector('.tab-save') as HTMLButtonElement).disabled).toBe(false);
    (el.querySelector('.tab-save') as HTMLButtonElement).click();
    await flush();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.reload-tip')?.textContent).toContain('已保存');
  });
});

function electronStub<K extends keyof ElectronAppBridge>(key: K): ReturnType<typeof vi.fn> {
  return (window as unknown as { electron: Record<string, ReturnType<typeof vi.fn>> }).electron[
    key as string
  ];
}
