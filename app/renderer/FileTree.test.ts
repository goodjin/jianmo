import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import FileTree from './FileTree.vue';
import type { ElectronAppBridge } from './electronBridge';
import type { FileTreeListResult } from '../electron/fileTreeModel';

let mounted: { app: App; el: HTMLElement } | null = null;

function install(bridge: Partial<ElectronAppBridge>): void {
  (window as unknown as { electron: ElectronAppBridge }).electron = bridge;
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

describe('FileTree（树根 = 文件系统根）', () => {
  it('从根目录铺开完整文件夹树，并自动展开当前文档所在的目录链', async () => {
    const listFileTree = fakeList();
    install({ listFileTree });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    // 树根是文件系统根，不是文档所在目录
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
