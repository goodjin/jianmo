import { contextBridge, ipcRenderer } from 'electron';

/**
 * 安全桥：在 contextIsolation 下向 renderer 暴露最小 IPC 面。
 * renderer 的 vscodeShim 据此实现 useVSCode 契约（postMessage/onMessage/getState/setState）。
 */
contextBridge.exposeInMainWorld('electron', {
  // WebViewMessage → main
  postMessage: (msg: unknown) => ipcRenderer.send('host:msg', msg),
  // main → ExtensionMessage 推送
  onPush: (handler: (msg: unknown) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, msg: unknown) => handler(msg);
    ipcRenderer.on('host:push', listener);
    return () => ipcRenderer.removeListener('host:push', listener);
  },
  // webview 状态记忆（getState/setState）；同步以满足 useVSCode 的同步语义
  storeGet: (key: string): unknown => ipcRenderer.sendSync('host:store:get', key),
  storeSet: (key: string, val: unknown): void => {
    ipcRenderer.sendSync('host:store:set', key, val);
  },
  // 应用本地能力（不走 shim）：调起系统文件选择、读当前打开路径、写入剪贴板、最近打开
  openFile: (): Promise<string | null> => ipcRenderer.invoke('app:open-file'),
  openPath: (filePath: string): Promise<string | null> => ipcRenderer.invoke('app:open-path', filePath),
  listRecentFiles: (): Promise<unknown> => ipcRenderer.invoke('app:recent-files:list'),
  removeRecentFile: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('app:recent-files:remove', filePath),
  clearRecentFiles: (): Promise<unknown> => ipcRenderer.invoke('app:recent-files:clear'),
  listDirMarkdown: (payload: { filePath: string; offset?: number }): Promise<unknown> =>
    ipcRenderer.invoke('app:list-dir-markdown', payload),
  fileTreeRoot: (): Promise<string> => ipcRenderer.invoke('app:file-tree:root'),
  pickFileTreeRoot: (): Promise<string | null> => ipcRenderer.invoke('app:file-tree:pick'),
  setFileTreeRoot: (dir: string): Promise<string> => ipcRenderer.invoke('app:file-tree:set-root', dir),
  listFileTree: (dir: string): Promise<unknown> => ipcRenderer.invoke('app:file-tree:list', dir),
  onFileTreeRoot: (handler: (root: string) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, root: unknown) => {
      handler(typeof root === 'string' ? root : '');
    };
    ipcRenderer.on('app:file-tree:root', listener);
    return () => ipcRenderer.removeListener('app:file-tree:root', listener);
  },
  copyToClipboard: (payload: { text: string; html: string }): Promise<boolean> =>
    ipcRenderer.invoke('app:copy-document', payload),
  onCopyRequest: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on('app:copy-request', listener);
    return () => ipcRenderer.removeListener('app:copy-request', listener);
  },
  // 多标签页：renderer 只读视图 + 三个动作，状态源在主进程
  tabsState: (): unknown => ipcRenderer.sendSync('app:tabs:state'),
  newTab: (): Promise<unknown> => ipcRenderer.invoke('app:tabs:new'),
  activateTab: (id: string): Promise<unknown> => ipcRenderer.invoke('app:tabs:activate', id),
  closeTab: (id: string): Promise<unknown> => ipcRenderer.invoke('app:tabs:close', id),
  openSettingsTab: (): Promise<unknown> => ipcRenderer.invoke('app:tabs:settings'),
  // 外观设置：同步读当前值，异步写补丁
  getAppearance: (): unknown => ipcRenderer.sendSync('app:settings:get'),
  updateAppearance: (patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('app:settings:update', patch),
  onTabsChanged: (handler: (view: unknown) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, view: unknown) => handler(view);
    ipcRenderer.on('app:tabs', listener);
    return () => ipcRenderer.removeListener('app:tabs', listener);
  },
  currentFilePath: (): string | null => {
    const v = ipcRenderer.sendSync('host:current-file-path');
    return typeof v === 'string' && v.length > 0 ? v : null;
  },
});
