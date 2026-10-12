import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { headingNodeId, parseHeadings } from '@wv/shared/outline';
import PreviewApp from './PreviewApp.vue';
import { installVsCodeShim } from './vscodeShim';
import { SELECTION_COPY_TYPE } from '../electron/selectionCopy';
import type { ElectronAppBridge } from './electronBridge';

let mounted: { app: App; el: HTMLElement } | null = null;

function install(bridge: Partial<ElectronAppBridge>): void {
  (window as unknown as { electron: ElectronAppBridge }).electron = bridge;
  installVsCodeShim();
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await nextTick();
  }
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

    const copy = el.querySelector('.tab-copy') as HTMLElement;
    const exp = el.querySelector('.export-split') as HTMLElement;
    const plus = el.querySelector('.tab-new') as HTMLElement;
    expect(copy).not.toBeNull();
    expect(exp).not.toBeNull();
    // 复制、导出依次排在 "+" 前面
    expect(copy.nextElementSibling).toBe(exp);
    expect(exp.nextElementSibling).toBe(plus);
    // 图标按钮：不再带「复制」文字
    expect(copy.textContent?.trim()).not.toContain('复制');
    // 默认不展开格式菜单
    expect(el.querySelector('.export-menu')).toBeNull();
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
    expect(button.disabled).toBe(true);
    (el.querySelector('.export-split') as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
    button.click();
    await flush();
    expect(el.querySelector('.export-menu')).toBeNull();
    expect(electronStub('exportDocument')).not.toHaveBeenCalled();
  });

  it('设置固定在「最近打开」面板最后一行，点击进设置页', async () => {
    const el = mount();
    await flush();

    (el.querySelector('.open-caret') as HTMLElement).click();
    await flush();
    const menu = el.querySelector('.recent-menu')!;
    const settings = menu.querySelector('.recent-settings-btn') as HTMLElement;
    expect(settings).not.toBeNull();
    // 固定最后一行：面板里它就是结尾
    expect(menu.lastElementChild!.contains(settings)).toBe(true);

    settings.click();
    await flush();
    expect(electronStub('openSettingsTab')).toHaveBeenCalled();
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
