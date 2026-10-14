import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import FileTree from './FileTree.vue';
import fileTreeSource from './FileTree.vue?raw';
import { chromeRadiusStyle } from '../chromeRadius';
import type { ElectronAppBridge } from './electronBridge';
import type { FileTreeListResult } from '../electron/fileTreeModel';

let mounted: { app: App; el: HTMLElement } | null = null;

function install(bridge: Partial<ElectronAppBridge>): void {
  (window as unknown as { electron: ElectronAppBridge }).electron = {
    fileTreeRoot: async () => '/',
    ...bridge,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

function mount(props: Record<string, unknown> = {}): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(FileTree, { collapsed: false, activePath: '', ...props });
  app.mount(el);
  mounted = { app, el };
  return el;
}

afterEach(() => {
  mounted?.app.unmount();
  mounted?.el.remove();
  mounted = null;
  delete (window as unknown as { electron?: ElectronAppBridge }).electron;
});

/** 一棵固定的测试树：根 / → docs/other，docs → notes，notes → b.md */
const TREE: Record<string, FileTreeListResult> = {
  '/': {
    dir: '/',
    entries: [
      { name: 'docs', path: '/docs', kind: 'dir' },
      { name: 'other', path: '/other', kind: 'dir' },
    ],
    error: '',
  },
  '/docs': {
    dir: '/docs',
    entries: [
      { name: 'notes', path: '/docs/notes', kind: 'dir' },
      { name: 'a.md', path: '/docs/a.md', kind: 'file' },
    ],
    error: '',
  },
  '/docs/notes': {
    dir: '/docs/notes',
    entries: [{ name: 'b.md', path: '/docs/notes/b.md', kind: 'file' }],
    error: '',
  },
  '/other': {
    dir: '/other',
    entries: [{ name: 'c.md', path: '/other/c.md', kind: 'file' }],
    error: '',
  },
};

function fakeList(): ReturnType<typeof vi.fn> {
  return vi.fn(async (dir: string) => TREE[dir] ?? { dir, entries: [], error: '' });
}

describe('FileTree（树根由主进程给定，默认是用户目录）', () => {
  it('从给定的根铺开文件夹树，并自动展开当前文档所在的目录链', async () => {
    const listFileTree = fakeList();
    install({ listFileTree });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    // 树根是主进程给的目录，不是临时改成文档所在文件夹
    expect(listFileTree).toHaveBeenCalledWith('/');
    expect(el.querySelector('.file-root')!.textContent).toBe('/');
    // 祖父、父目录与当前目录都展开：b.md 的行存在且标记为当前
    const current = el.querySelector('.tree-row.current') as HTMLElement;
    expect(current?.getAttribute('data-path')).toBe('/docs/notes/b.md');
    // 只展开文档链：与文档无关的 /other 从不被读取（保持收起）
    expect(listFileTree).not.toHaveBeenCalledWith('/other');
    expect(listFileTree.mock.calls.map((c) => c[0]).sort()).toEqual(['/', '/docs', '/docs/notes']);
  });

  it('点开收起的文件夹按需加载其子层', async () => {
    const listFileTree = fakeList();
    install({ listFileTree });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();
    expect(listFileTree).not.toHaveBeenCalledWith('/other');

    (el.querySelector('[data-path="/other"]') as HTMLElement).click();
    await flush();
    expect(listFileTree).toHaveBeenCalledWith('/other');
    expect(el.querySelector('[data-path="/other/c.md"]')).not.toBeNull();
  });

  it('点击 Markdown 文件交给主进程打开', async () => {
    const openPath = vi.fn(async () => '/docs/notes/b.md');
    install({ listFileTree: fakeList(), openPath });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    (el.querySelector('[data-path="/docs/notes/b.md"]') as HTMLElement).click();
    await flush();
    expect(openPath).toHaveBeenCalledWith('/docs/notes/b.md');
  });

  it('换文档后树自动跳到新文档所在的目录链', async () => {
    const listFileTree = fakeList();
    install({ listFileTree });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();
    expect(el.querySelector('.tree-row.current')!.getAttribute('data-path')).toBe('/docs/notes/b.md');

    const app = mounted!.app;
    app._instance!.props.activePath = '/other/c.md';
    await flush();

    expect(listFileTree).toHaveBeenCalledWith('/other');
    const current = el.querySelector('.tree-row.current') as HTMLElement;
    expect(current?.getAttribute('data-path')).toBe('/other/c.md');
  });

  it('默认停在用户主目录，不从磁盘根铺开', async () => {
    const listFileTree = vi.fn(async (dir: string) => {
      if (dir === '/home/me') {
        return {
          dir,
          entries: [
            { name: 'docs', path: '/home/me/docs', kind: 'dir' },
            { name: 'readme.md', path: '/home/me/readme.md', kind: 'file' },
          ],
          error: '',
        };
      }
      if (dir === '/home/me/docs') {
        return { dir, entries: [{ name: 'a.md', path: '/home/me/docs/a.md', kind: 'file' }], error: '' };
      }
      return { dir, entries: [], error: '' };
    });
    install({ fileTreeRoot: async () => '/home/me', listFileTree });
    const el = mount({ activePath: '/home/me/docs/a.md' });
    await flush();

    expect(listFileTree).toHaveBeenCalledWith('/home/me');
    expect(listFileTree).not.toHaveBeenCalledWith('/');
    expect(el.querySelector('.file-root')!.textContent).toBe('me');
    expect(el.querySelector('.tree-row.current')!.getAttribute('data-path')).toBe('/home/me/docs/a.md');
    expect((el.querySelector('.file-up') as HTMLButtonElement).disabled).toBe(false);
  });

  it('向上按钮跳到父目录并记住，到磁盘根后按钮禁用', async () => {
    const listFileTree = vi.fn(async (dir: string) => ({
      dir,
      entries: dir === '/' ? [{ name: 'home', path: '/home', kind: 'dir' as const }] : [],
      error: '',
    }));
    const setFileTreeRoot = vi.fn(async (dir: string) => dir);
    install({ fileTreeRoot: async () => '/home', listFileTree, setFileTreeRoot });
    const el = mount({ activePath: '' });
    await flush();

    const up = el.querySelector('.file-up') as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    up.click();
    await flush();

    expect(setFileTreeRoot).toHaveBeenCalledWith('/');
    expect(listFileTree).toHaveBeenCalledWith('/');
    expect(el.querySelector('.file-root')!.textContent).toBe('/');
    expect((el.querySelector('.file-up') as HTMLButtonElement).disabled).toBe(true);
  });

  it('窄图标按钮用更小的圆角，同一排的文字按钮仍用按钮圆角', async () => {
    const css = fileTreeSource.match(/<style scoped>([\s\S]*?)<\/style>/);
    expect(css).not.toBeNull();
    const style = document.createElement('style');
    style.textContent = css![1];
    document.head.appendChild(style);
    install({ listFileTree: fakeList() });
    const el = mount({ activePath: '' });
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
      expect(height('.file-up')).toBe('28px');
      expect(height('.file-toggle')).toBe('28px');
      expect(height('.file-icon-btn:not(.file-up)')).toBe('28px');
    } finally {
      style.remove();
    }
  });

  it('收起后不渲染树，切换按钮通知外层', async () => {
    const onToggle = vi.fn();
    install({ listFileTree: fakeList() });
    const el = mount({ collapsed: true, activePath: '/docs/notes/b.md', onToggle });
    await flush();
    expect(el.querySelector('.tree')).toBeNull();
    (el.querySelector('.file-toggle') as HTMLElement).click();
    expect(onToggle).toHaveBeenCalled();
  });
});
