import { describe, expect, it, vi } from 'vitest';
import {
  bindWindowRevealEvents,
  handleAppActivate,
  handleExternalFileOpen,
  revealAppWindow,
  scheduleHiddenWindowReveal,
  showAppInDock,
  type RevealableWindow,
  type RevealEventSource,
} from './fileOpenWindow';

function fakeWindow(overrides: Partial<RevealableWindow> = {}): RevealableWindow & {
  calls: string[];
  workspaceOptions: unknown[];
} {
  const calls: string[] = [];
  const workspaceOptions: unknown[] = [];
  return {
    calls,
    workspaceOptions,
    isMinimized: () => false,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
    setVisibleOnAllWorkspaces: (visible, options) => {
      calls.push(visible ? 'spaces-on' : 'spaces-off');
      workspaceOptions.push(options);
    },
    moveTop: () => calls.push('moveTop'),
    ...overrides,
  };
}

const keptInDock = { visibleOnFullScreen: true, skipTransformProcessType: true };

describe('revealAppWindow', () => {
  it('最小化时先还原，再显示并聚焦', () => {
    const win = fakeWindow({ isMinimized: () => true });
    const focus = vi.fn();
    revealAppWindow(win, { focus }, 'win32');
    expect(win.calls).toEqual(['restore', 'show', 'focus']);
    expect(focus).not.toHaveBeenCalled();
  });

  it('macOS 抢到前台，并临时跨桌面显示后再回到当前桌面', () => {
    const win = fakeWindow();
    const focus = vi.fn();
    revealAppWindow(win, { focus }, 'darwin');
    expect(win.calls).toEqual(['show', 'focus', 'spaces-on', 'focus', 'spaces-off', 'moveTop']);
    expect(win.workspaceOptions).toEqual([keptInDock, keptInDock]);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ steal: true });
  });

  it('macOS 跨桌面之后仍把图标留在程序坞', () => {
    const win = fakeWindow();
    const showInDock = vi.fn(() => {
      win.calls.push('dock');
    });
    revealAppWindow(win, { focus: vi.fn(), showInDock }, 'darwin');
    expect(win.calls).toEqual(['show', 'focus', 'spaces-on', 'focus', 'spaces-off', 'dock', 'moveTop']);
    expect(showInDock).toHaveBeenCalledTimes(1);
  });

  it('其他系统不改程序坞', () => {
    const win = fakeWindow();
    const showInDock = vi.fn();
    revealAppWindow(win, { focus: vi.fn(), showInDock }, 'win32');
    expect(showInDock).not.toHaveBeenCalled();
    expect(win.workspaceOptions).toEqual([]);
  });

  it('没有跨桌面接口时仍然抢前台', () => {
    const win = fakeWindow({ setVisibleOnAllWorkspaces: undefined, moveTop: undefined });
    const focus = vi.fn();
    revealAppWindow(win, { focus }, 'darwin');
    expect(win.calls).toEqual(['show', 'focus']);
    expect(focus).toHaveBeenCalledWith({ steal: true });
  });
});

describe('showAppInDock', () => {
  it('图标不在时设成普通应用并显示', () => {
    const show = vi.fn();
    const setActivationPolicy = vi.fn();
    showAppInDock({
      setActivationPolicy,
      dock: { isVisible: () => false, show },
    });
    expect(setActivationPolicy).toHaveBeenCalledWith('regular');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('图标已经在时不再显示，避免叠出两个', () => {
    const show = vi.fn();
    showAppInDock({
      setActivationPolicy: vi.fn(),
      dock: { isVisible: () => true, show },
    });
    expect(show).not.toHaveBeenCalled();
  });

  it('没有程序坞对象时仍设成普通应用', () => {
    const setActivationPolicy = vi.fn();
    showAppInDock({ setActivationPolicy, dock: null });
    expect(setActivationPolicy).toHaveBeenCalledWith('regular');
  });
});

describe('bindWindowRevealEvents', () => {
  it('画出来、加载完、加载失败都会再显示', () => {
    const listeners = new Map<string, () => void>();
    const win: RevealEventSource = {
      once: (event, listener) => listeners.set(event, listener),
      webContents: {
        once: (event, listener) => listeners.set(event, listener),
      },
    };
    const reveal = vi.fn();
    bindWindowRevealEvents(win, reveal);
    expect(listeners.size).toBe(3);
    listeners.get('ready-to-show')?.();
    listeners.get('did-finish-load')?.();
    listeners.get('did-fail-load')?.();
    expect(reveal).toHaveBeenCalledTimes(3);
  });
});

describe('scheduleHiddenWindowReveal', () => {
  it('非 macOS 不安排补救', () => {
    const schedule = vi.fn();
    scheduleHiddenWindowReveal(() => true, vi.fn(), schedule, 'linux');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('macOS 在 0ms 和 250ms 后，窗口仍不可见才再显示', () => {
    const queued: Array<{ fn: () => void; ms: number }> = [];
    const reveal = vi.fn();
    let hidden = true;
    scheduleHiddenWindowReveal(
      () => hidden,
      reveal,
      (fn, ms) => queued.push({ fn, ms }),
      'darwin'
    );
    expect(queued.map((item) => item.ms)).toEqual([0, 250]);
    queued[0]?.fn();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith(0);
    hidden = false;
    queued[1]?.fn();
    expect(reveal).toHaveBeenCalledTimes(1);
  });
});

function deps(overrides: Partial<Parameters<typeof handleExternalFileOpen>[1]> = {}) {
  return {
    appReady: true,
    hasLiveWindow: true,
    queueFile: vi.fn(),
    loadFile: vi.fn(),
    createWindow: vi.fn(),
    emitActiveDocument: vi.fn(),
    revealWindow: vi.fn(),
    ...overrides,
  };
}

describe('handleExternalFileOpen', () => {
  it('应用还没准备好时只把路径排进队列，不建窗口', () => {
    const d = deps({ appReady: false });
    expect(handleExternalFileOpen('/a.md', d)).toBe('queued');
    expect(d.queueFile).toHaveBeenCalledWith('/a.md');
    expect(d.loadFile).not.toHaveBeenCalled();
    expect(d.createWindow).not.toHaveBeenCalled();
    expect(d.revealWindow).not.toHaveBeenCalled();
  });

  it('窗口还在时读入文件、刷新正文，并把窗口拉到前台', () => {
    const order: string[] = [];
    const loadFile = vi.fn(() => {
      order.push('load');
    });
    const emitActiveDocument = vi.fn(() => {
      order.push('emit');
    });
    const revealWindow = vi.fn(() => {
      order.push('reveal');
    });
    const createWindow = vi.fn();
    const queueFile = vi.fn();
    expect(
      handleExternalFileOpen('/a.md', {
        appReady: true,
        hasLiveWindow: true,
        queueFile,
        loadFile,
        createWindow,
        emitActiveDocument,
        revealWindow,
      })
    ).toBe('opened');
    expect(order).toEqual(['load', 'emit', 'reveal']);
    expect(createWindow).not.toHaveBeenCalled();
    expect(queueFile).not.toHaveBeenCalled();
  });

  it('窗口已关掉时先新建，再刷新并拉到前台', () => {
    const order: string[] = [];
    const loadFile = vi.fn(() => {
      order.push('load');
    });
    const createWindow = vi.fn(() => {
      order.push('create');
    });
    const emitActiveDocument = vi.fn(() => {
      order.push('emit');
    });
    const revealWindow = vi.fn(() => {
      order.push('reveal');
    });
    handleExternalFileOpen('/a.md', {
      appReady: true,
      hasLiveWindow: false,
      queueFile: vi.fn(),
      loadFile,
      createWindow,
      emitActiveDocument,
      revealWindow,
    });
    expect(order).toEqual(['load', 'create', 'emit', 'reveal']);
  });
});

describe('handleAppActivate', () => {
  it('ready 之前不创建窗口', () => {
    const createWindow = vi.fn();
    const revealWindow = vi.fn();
    handleAppActivate({ appReady: false, hasLiveWindow: false, createWindow, revealWindow });
    expect(createWindow).not.toHaveBeenCalled();
    expect(revealWindow).not.toHaveBeenCalled();
  });

  it('没有窗口时新建并显示', () => {
    const createWindow = vi.fn();
    const revealWindow = vi.fn();
    handleAppActivate({ appReady: true, hasLiveWindow: false, createWindow, revealWindow });
    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(revealWindow).toHaveBeenCalledTimes(1);
  });

  it('窗口已经在时不再新建，只拉到前台', () => {
    const createWindow = vi.fn();
    const revealWindow = vi.fn();
    handleAppActivate({ appReady: true, hasLiveWindow: true, createWindow, revealWindow });
    expect(createWindow).not.toHaveBeenCalled();
    expect(revealWindow).toHaveBeenCalledTimes(1);
  });
});
