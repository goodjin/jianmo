import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import PreviewApp from './PreviewApp.vue';
import { installVsCodeShim } from './vscodeShim';
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
  it('文档有标题时显示大纲栏；没标题时整栏连展开/收起按钮一起消失', async () => {
    const el = mount();
    await flush();

    pushMsg('CONTENT_UPDATE', { content: '# 标题一\n\n正文' });
    await flush();
    expect(el.querySelector('.outline-sidebar')).not.toBeNull();
    expect(el.querySelector('.markly-app')!.classList.contains('no-outline')).toBe(false);

    pushMsg('CONTENT_UPDATE', { content: '只有正文，没有任何标题' });
    await flush();
    expect(el.querySelector('.outline-sidebar')).toBeNull();
    expect(el.querySelector('.outline-toggle')).toBeNull();
    expect(el.querySelector('.markly-app')!.classList.contains('no-outline')).toBe(true);
  });

  it('打开按钮在标签栏最左，复制是新建标签页左侧的小图标', async () => {
    const el = mount();
    await flush();

    const bar = el.querySelector('.tab-bar')!;
    const first = bar.firstElementChild as HTMLElement;
    expect(first.classList.contains('open-split')).toBe(true);

    const copy = el.querySelector('.tab-copy') as HTMLElement;
    const plus = el.querySelector('.tab-new') as HTMLElement;
    expect(copy).not.toBeNull();
    // 复制紧跟在 "+" 前面
    expect(plus.previousElementSibling).toBe(copy);
    // 图标按钮：不再带「复制」文字
    expect(copy.textContent?.trim()).not.toContain('复制');
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

  it('把 Markdown 文档拖进界面自动打开，其它类型忽略', async () => {
    mount();
    await flush();

    dropFiles([
      { path: '/docs/a.md', name: 'a.md' },
      { path: '/docs/readme.txt', name: 'readme.txt' },
      { path: '/docs/b.markdown', name: 'b.markdown' },
    ]);
    await flush();

    const openPath = electronStub('openPath');
    expect(openPath.mock.calls.map((c) => c[0])).toEqual(['/docs/a.md', '/docs/b.markdown']);
  });
});

function electronStub<K extends keyof ElectronAppBridge>(key: K): ReturnType<typeof vi.fn> {
  return (window as unknown as { electron: Record<string, ReturnType<typeof vi.fn>> }).electron[
    key as string
  ];
}
