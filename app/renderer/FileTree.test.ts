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

  function menuItems(): HTMLButtonElement[] {
    return [...document.body.querySelectorAll('.tree-menu button')] as HTMLButtonElement[];
  }

  function openFileMenu(el: HTMLElement, filePath: string): void {
    const row = el.querySelector(`[data-path="${filePath}"]`) as HTMLElement;
    row.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 40 })
    );
  }

  it('文件右键菜单可以复制路径、文件名，并在 Finder 中显示', async () => {
    const copyExactText = vi.fn(async () => true);
    const revealInFolder = vi.fn(async () => true);
    install({ listFileTree: fakeList(), copyExactText, revealInFolder });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    const row = el.querySelector('[data-path="/docs/notes/b.md"]') as HTMLElement;
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 40,
    });
    row.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(menuItems().map((btn) => btn.textContent)).toEqual([
      '重命名',
      '在 Finder 打开',
      '复制全路径',
      '复制文件名',
      '删除',
    ]);

    menuItems()[3]!.click();
    await flush();
    expect(copyExactText).toHaveBeenCalledWith('b.md');
    expect(document.body.querySelector('.tree-menu')).toBeNull();

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    menuItems()[2]!.click();
    await flush();
    expect(copyExactText).toHaveBeenCalledWith('/docs/notes/b.md');

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    menuItems()[1]!.click();
    await flush();
    expect(revealInFolder).toHaveBeenCalledWith('/docs/notes/b.md');
  });

  function clickMenu(label: string): void {
    const btn = menuItems().find((item) => item.textContent === label);
    expect(btn).toBeTruthy();
    btn!.click();
  }

  it('点删除只出现确认，再点移到废纸篓才删掉并刷新目录', async () => {
    let trashed = false;
    const listFileTree = vi.fn(async (dir: string) => {
      if (trashed && dir === '/docs/notes') return { dir, entries: [], error: '' };
      return TREE[dir] ?? { dir, entries: [], error: '' };
    });
    const trashFile = vi.fn(async (filePath: string) => {
      trashed = true;
      return { ok: true, path: filePath, error: '' };
    });
    install({ listFileTree, trashFile });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    clickMenu('删除');
    await flush();
    expect(trashFile).not.toHaveBeenCalled();
    expect(document.body.querySelector('.tree-menu-confirm')?.textContent).toBe('要把「b.md」移到废纸篓吗？');

    clickMenu('取消');
    await flush();
    expect(trashFile).not.toHaveBeenCalled();
    expect(document.body.querySelector('.tree-menu')).toBeNull();
    expect(el.querySelector('[data-path="/docs/notes/b.md"]')).not.toBeNull();

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    clickMenu('删除');
    await flush();
    clickMenu('移到废纸篓');
    await flush();
    expect(trashFile).toHaveBeenCalledTimes(1);
    expect(trashFile).toHaveBeenCalledWith('/docs/notes/b.md');
    expect(document.body.querySelector('.tree-menu')).toBeNull();
    expect(el.querySelector('[data-path="/docs/notes/b.md"]')).toBeNull();
  });

  it('移到废纸篓失败时留下说明，文件还在', async () => {
    const trashFile = vi.fn(async (filePath: string) => ({
      ok: false,
      path: filePath,
      error: '文件正在使用',
    }));
    install({ listFileTree: fakeList(), trashFile });
    const el = mount({ activePath: '/docs/a.md' });
    await flush();

    openFileMenu(el, '/docs/a.md');
    await flush();
    clickMenu('删除');
    await flush();
    clickMenu('移到废纸篓');
    await flush();

    expect(trashFile).toHaveBeenCalledWith('/docs/a.md');
    expect(document.body.querySelector('.tree-menu-error')?.textContent).toBe('文件正在使用');
    expect(el.querySelector('[data-path="/docs/a.md"]')).not.toBeNull();
    expect(menuItems().some((btn) => btn.textContent === '移到废纸篓')).toBe(true);
  });

  it('确认时按 Esc 或点外面会取消，不会删除', async () => {
    const trashFile = vi.fn(async () => ({ ok: true, path: '/docs/a.md', error: '' }));
    install({ listFileTree: fakeList(), trashFile });
    const el = mount({ activePath: '/docs/a.md' });
    await flush();

    openFileMenu(el, '/docs/a.md');
    await flush();
    clickMenu('删除');
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(document.body.querySelector('.tree-menu')).toBeNull();
    expect(trashFile).not.toHaveBeenCalled();

    openFileMenu(el, '/docs/a.md');
    await flush();
    clickMenu('删除');
    await flush();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    expect(document.body.querySelector('.tree-menu')).toBeNull();
    expect(trashFile).not.toHaveBeenCalled();
  });

  it('点菜单外面或按 Esc 会收起；文件夹右键没有这几个菜单', async () => {
    install({ listFileTree: fakeList() });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    const dir = el.querySelector('[data-path="/docs"]') as HTMLElement;
    const dirEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    dir.dispatchEvent(dirEvent);
    await flush();
    expect(dirEvent.defaultPrevented).toBe(false);
    expect(document.body.querySelector('.tree-menu')).toBeNull();

    openFileMenu(el, '/docs/a.md');
    await flush();
    expect(document.body.querySelector('.tree-menu')).not.toBeNull();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    expect(document.body.querySelector('.tree-menu')).toBeNull();

    openFileMenu(el, '/docs/a.md');
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(document.body.querySelector('.tree-menu')).toBeNull();
  });

  it('重命名成功后刷新所在目录，非法名字和重名留在输入框里', async () => {
    let renamed = false;
    const listFileTree = vi.fn(async (dir: string) => {
      if (renamed && dir === '/docs/notes') {
        return {
          dir,
          entries: [{ name: 'c.md', path: '/docs/notes/c.md', kind: 'file' as const }],
          error: '',
        };
      }
      return TREE[dir] ?? { dir, entries: [], error: '' };
    });
    const renameFile = vi.fn(async (from: string, name: string) => {
      if (name === 'taken.md') return { ok: false, path: from, error: '已有同名文件' };
      renamed = true;
      return { ok: true, path: '/docs/notes/c.md', error: '' };
    });
    install({ listFileTree, renameFile });
    const el = mount({ activePath: '/docs/notes/b.md' });
    await flush();

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    menuItems()[0]!.click();
    await flush();

    const input = el.querySelector('.tree-rename') as HTMLInputElement;
    expect(input.value).toBe('b.md');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(renameFile).not.toHaveBeenCalled();
    expect(el.querySelector('.tree-rename')).toBeNull();

    openFileMenu(el, '/docs/notes/b.md');
    await flush();
    menuItems()[0]!.click();
    await flush();
    const again = el.querySelector('.tree-rename') as HTMLInputElement;
    again.value = 'a/b.md';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(renameFile).not.toHaveBeenCalled();
    expect(el.querySelector('.tree-rename-error')?.textContent).toBe('文件名不能包含斜杠');

    again.value = 'taken.md';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(renameFile).toHaveBeenCalledWith('/docs/notes/b.md', 'taken.md');
    expect(el.querySelector('.tree-rename-error')?.textContent).toBe('已有同名文件');

    again.value = 'c.md';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(renameFile).toHaveBeenCalledWith('/docs/notes/b.md', 'c.md');
    expect(el.querySelector('[data-path="/docs/notes/c.md"]')).not.toBeNull();
    expect(el.querySelector('.tree-rename')).toBeNull();
    expect(listFileTree.mock.calls.filter((call) => call[0] === '/docs/notes').length).toBeGreaterThan(1);
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
