/**
 * 访达双击文档、或点程序坞图标时，决定要不要新建窗口、以及怎样把窗口拉到前台。
 *
 * macOS 上应用没退出时，双击文件只会收到 open-file，系统不一定把窗口带到前面。
 * 冷启动时 open-file / activate 还可能发生在 app ready 之前，这时不能创建窗口。
 *
 * 跨桌面时不能带 visibleOnFullScreen。那个选项会让窗口变成「全屏辅助」：
 * 铺满整块屏幕，但没有进入全屏。标题栏钻进菜单栏，底部被程序坞挡住，
 * 关闭和缩小都点不到，程序坞里也可能没有图标。
 * 同时必须跳过进程类型切换，否则系统会把应用当成菜单栏小工具，图标从程序坞消失。
 */

import { isCoveringSystemChrome, restoredFrame, type DisplayFrame, type Rect } from './windowFrame';

/** 不铺满屏幕，也不把应用改成菜单栏小工具。 */
const KEEP_IN_DOCK = {
  visibleOnFullScreen: false,
  skipTransformProcessType: true,
} as const;

export interface RevealableWindow {
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
  isDestroyed?: () => boolean;
  isFullScreen?: () => boolean;
  isSimpleFullScreen?: () => boolean;
  getBounds?: () => Rect;
  setBounds?: (bounds: Rect) => void;
  /** 把窗口短暂放到所有桌面，再收回当前桌面，否则它会停在别的空间里。 */
  setVisibleOnAllWorkspaces?(
    visible: boolean,
    options?: { visibleOnFullScreen?: boolean; skipTransformProcessType?: boolean }
  ): void;
  moveTop?(): void;
}

export interface RevealableApp {
  focus(options?: { steal: boolean }): void;
  /** macOS：保证图标出现在程序坞。跨桌面之后系统有时会把它拿掉。 */
  showDock?: () => void;
}

export type DisplayLookup = (bounds: Rect) => DisplayFrame | null;

export interface RevealEventSource {
  once(event: 'ready-to-show', listener: () => void): void;
  webContents: {
    once(event: 'did-finish-load' | 'did-fail-load', listener: () => void): void;
  };
}

function inRealFullscreen(win: RevealableWindow): boolean {
  return win.isFullScreen?.() === true || win.isSimpleFullScreen?.() === true;
}

/** 铺满整屏却没进全屏时，把窗口收回可见区域。真正的全屏不动。 */
function pullBackFromSystemChrome(win: RevealableWindow, before: Rect | null, displayFor?: DisplayLookup): void {
  if (win.isDestroyed?.() || inRealFullscreen(win)) return;
  const after = win.getBounds?.();
  if (!after || !win.setBounds || !displayFor) return;
  const display = displayFor(after);
  if (!display) return;
  const next = restoredFrame(before, after, display);
  if (!next) return;
  win.setBounds(next);
}

/** 最小化先还原，再显示并聚焦。macOS 还要抢到前台，否则窗口建了也看不见。 */
export function revealAppWindow(
  win: RevealableWindow,
  host: RevealableApp,
  platform: string,
  displayFor?: DisplayLookup,
  schedule?: (fn: () => void, ms: number) => void
): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (platform !== 'darwin') return;
  host.showDock?.();
  host.focus({ steal: true });
  const before = win.getBounds?.() ?? null;
  // 已经在真正全屏里时，不要再改集合行为，否则会把全屏拆掉。
  if (!inRealFullscreen(win) && typeof win.setVisibleOnAllWorkspaces === 'function') {
    win.setVisibleOnAllWorkspaces(true, KEEP_IN_DOCK);
    win.focus();
    win.setVisibleOnAllWorkspaces(false, KEEP_IN_DOCK);
  }
  win.moveTop?.();
  host.showDock?.();
  const fix = (): void => pullBackFromSystemChrome(win, before, displayFor);
  fix();
  // 系统有时在这次调用返回之后才把窗口拉大，过一会儿再量一次。
  if (schedule && displayFor) {
    schedule(fix, 0);
    schedule(fix, 50);
  }
}

export interface GuardableWindow {
  isDestroyed?: () => boolean;
  isFullScreen?: () => boolean;
  isSimpleFullScreen?: () => boolean;
  getBounds: () => Rect;
  setBounds: (bounds: Rect) => void;
  on(event: 'show', listener: () => void): void;
}

/**
 * 窗口刚显示时，如果已经铺到菜单栏上，就拉回默认大小。
 * 不听后续的缩放：用户点绿色按钮进入真全屏时，系统会先把窗口拉大，再标记为全屏。
 * 连续纠正几次仍被系统拉回去就停下，避免来回改大小。
 */
export function attachOversizedWindowGuard(win: GuardableWindow, displayFor: DisplayLookup): void {
  let correcting = false;
  let corrections = 0;
  const pull = (): void => {
    if (correcting || corrections >= 4) return;
    if (win.isDestroyed?.() || win.isFullScreen?.() || win.isSimpleFullScreen?.()) return;
    const after = win.getBounds();
    const display = displayFor(after);
    if (!display || !isCoveringSystemChrome(after, display)) return;
    const next = restoredFrame(null, after, display);
    if (!next) return;
    corrections += 1;
    correcting = true;
    win.setBounds(next);
    correcting = false;
  };
  win.on('show', pull);
}

/**
 * 页面画出来、加载完、或加载失败，都再显示一次。
 * 只靠某一次 show() 时，macOS 可能在应用还没激活时把这次显示丢掉。
 */
export function bindWindowRevealEvents(win: RevealEventSource, reveal: () => void): void {
  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', reveal);
  win.webContents.once('did-fail-load', reveal);
}

/** 窗口过一会儿仍不可见时再拉一次。只有 macOS 会丢掉第一次显示。 */
export function scheduleHiddenWindowReveal(
  isStillHidden: () => boolean,
  reveal: (delayMs: number) => void,
  schedule: (fn: () => void, ms: number) => void,
  platform: string
): void {
  if (platform !== 'darwin') return;
  for (const delayMs of [0, 250]) {
    schedule(() => {
      if (isStillHidden()) reveal(delayMs);
    }, delayMs);
  }
}

export interface ExternalFileOpenDeps {
  appReady: boolean;
  hasLiveWindow: boolean;
  queueFile: (filePath: string) => void;
  loadFile: (filePath: string) => void | Promise<void>;
  createWindow: () => void;
  emitActiveDocument: () => void;
  revealWindow: () => void;
}

export function handleExternalFileOpen(filePath: string, deps: ExternalFileOpenDeps): 'queued' | 'opened' {
  if (!deps.appReady) {
    deps.queueFile(filePath);
    return 'queued';
  }
  const loaded = deps.loadFile(filePath);
  const finish = (): void => {
    if (!deps.hasLiveWindow) deps.createWindow();
    deps.emitActiveDocument();
    deps.revealWindow();
  };
  // 要先问未保存时，读文件是异步的。等它结束再刷新，避免窗口先画出旧正文。
  if (loaded && typeof (loaded as Promise<void>).then === 'function') {
    if (!deps.hasLiveWindow) deps.createWindow();
    void (loaded as Promise<void>).then(() => {
      deps.emitActiveDocument();
      deps.revealWindow();
    });
    return 'opened';
  }
  finish();
  return 'opened';
}

export interface AppActivateDeps {
  appReady: boolean;
  hasLiveWindow: boolean;
  createWindow: () => void;
  revealWindow: () => void;
}

/** 点程序坞：还没 ready 就什么都不做；没窗口就新建；已有窗口也要拉到前台。 */
export function handleAppActivate(deps: AppActivateDeps): void {
  if (!deps.appReady) return;
  if (!deps.hasLiveWindow) deps.createWindow();
  deps.revealWindow();
}
