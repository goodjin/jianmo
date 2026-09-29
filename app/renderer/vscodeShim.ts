import type { ExtensionMessage, WebViewMessage } from '@types';

interface ElectronBridge {
  postMessage: (msg: unknown) => void;
  onPush: (handler: (msg: unknown) => void) => () => void;
  storeGet: (key: string) => unknown;
  storeSet: (key: string, val: unknown) => void;
}

function getElectron(): ElectronBridge {
  const e = (window as unknown as { electron?: ElectronBridge }).electron;
  if (!e) {
    throw new Error('electron bridge missing (preload not loaded?)');
  }
  return e;
}

/**
 * 注入满足 useVSCode 契约的 window.vscode，使 webview 侧组件零改动复用：
 * - postMessage(WebViewMessage) → ipc send('host:msg')
 * - onMessage(ExtensionMessage) ← ipc 'host:push' 派发 window MessageEvent（useVSCode.onMessage 监听它）
 * - getState/setState ← electron-store（同步，满足 useVSCode 的同步语义）
 *
 * 必须在 createApp().mount() 之前调用（组件 setup 即可能读 window.vscode）。
 */
export function installVsCodeShim(): void {
  const electron = getElectron();

  (window as unknown as { vscode: unknown }).vscode = {
    postMessage: (msg: WebViewMessage): void => {
      electron.postMessage(msg);
    },
    getState: (): unknown => {
      try {
        return electron.storeGet('webviewState');
      } catch {
        return null;
      }
    },
    setState: (s: unknown): void => {
      try {
        electron.storeSet('webviewState', s);
      } catch {
        /* ignore */
      }
    },
  };

  electron.onPush((msg: ExtensionMessage) => {
    window.dispatchEvent(new MessageEvent('message', { data: msg }));
  });
}
