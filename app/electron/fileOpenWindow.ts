/**
 * 访达双击文档、或点程序坞图标时，决定要不要新建窗口、以及怎样把窗口拉到前台。
 *
 * macOS 上应用没退出时，双击文件只会收到 open-file，系统不一定把窗口带到前面。
 * 冷启动时 open-file / activate 还可能发生在 app ready 之前，这时不能创建窗口。
 */

export interface RevealableWindow {
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
  /** 把窗口短暂放到所有桌面，再收回当前桌面，否则它会停在别的空间里。 */
  setVisibleOnAllWorkspaces?(visible: boolean, options?: { visibleOnFullScreen?: boolean }): void;
  moveTop?(): void;
}

export interface RevealableApp {
  focus(options?: { steal?: boolean }): void;
}

export interface RevealEventSource {
  once(event: 'ready-to-show', listener: () => void): void;
  webContents: {
    once(event: 'did-finish-load' | 'did-fail-load', listener: () => void): void;
  };
}

/** 最小化先还原，再显示并聚焦。macOS 还要抢到前台，否则窗口建了也看不见。 */
export function revealAppWindow(win: RevealableWindow, host: RevealableApp, platform: string): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (platform !== 'darwin') return;
  host.focus({ steal: true });
  if (typeof win.setVisibleOnAllWorkspaces === 'function') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.focus();
    win.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true });
  }
  win.moveTop?.();
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
  loadFile: (filePath: string) => void;
  createWindow: () => void;
  emitActiveDocument: () => void;
  revealWindow: () => void;
}

export function handleExternalFileOpen(filePath: string, deps: ExternalFileOpenDeps): 'queued' | 'opened' {
  if (!deps.appReady) {
    deps.queueFile(filePath);
    return 'queued';
  }
  deps.loadFile(filePath);
  if (!deps.hasLiveWindow) deps.createWindow();
  deps.emitActiveDocument();
  deps.revealWindow();
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
