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
    // 图标按钮：不再带「复制」文字，空闲时是复制符号
    expect(copy.textContent?.trim()).not.toContain('复制');
    expect(copy.textContent).toContain('⧉');
    expect(copy.querySelector('.tab-copy-mark')).toBeNull();
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
      expect(copy.textContent).not.toContain('⧉');
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
      expect(copy.textContent).toContain('⧉');
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
    expect(copy.getAttribute('aria-label')).toBe('复制失败');
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
