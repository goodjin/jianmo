import { app, BrowserWindow, clipboard, ipcMain, dialog, Menu, nativeTheme, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createHostBridge } from './hostBridge';
import { loadAppConfig, saveAppConfigPatch } from './config';
import { normalizeAppearancePatch, readAppearance } from './appearance';
import { markdownToHtml } from '../../src/core/export/htmlExport';
import { normalizeCopyPayload } from './copyPayload';
import { listMarkdownFilesPage } from './dirMarkdown';
import { listFileTree } from './fileTree';
import { filesystemRootOf } from './fileTreeModel';
import {
  DIR_MD_PAGE_SIZE,
  isMarkdownFileName,
  parseRecentFiles,
  removeRecentFile,
  upsertRecentFile,
  type RecentFileRecord,
} from './recentFiles';
import {
  activateTab,
  closeTab,
  createInitialState,
  getActiveTab,
  nextTabId,
  openBlankTab,
  openFileTab,
  openSettingsTab,
  setActiveContent,
  summarizeTabs,
  tabDisplayTitle,
  type TabsState,
} from './tabs';
import type { ExtensionConfig, ExtensionMessage } from '../../src/types';

const RECENT_STORE_KEY = 'recentFiles';
const FILE_TREE_ROOT_KEY = 'fileTreeRoot';

let mainWindow: BrowserWindow | null = null;
/** 唯一文档状态源：活动标签即"当前文档"，hostBridge 因此无需感知标签。 */
let tabs: TabsState = createInitialState(nextTabId());
let pendingFiles: string[] = [];
let store: Store;
/** hostBridge 持有同一个对象引用，改这里的字段即刻影响下一次预览渲染。 */
let appConfig: ExtensionConfig;

function activeFilePath(): string | null {
  const p = getActiveTab(tabs)?.filePath ?? '';
  return p || null;
}

function activeContent(): string {
  return getActiveTab(tabs)?.content ?? '';
}

function send(msg: ExtensionMessage): void {
  // darwin 关窗后 BrowserWindow 引用仍在但 webContents 已 destroyed；?. 不会救这种情形
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('host:push', msg);
  }
}

function pushTabs(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:tabs', summarizeTabs(tabs));
  }
}

function updateWindowTitle(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const active = getActiveTab(tabs);
  // 空白文档标签不占标题，保持窗口叫 Markly
  const name = !active || (active.kind === 'doc' && !active.filePath) ? '' : tabDisplayTitle(active);
  mainWindow.setTitle(name ? `${name} — Markly` : 'Markly');
}

/** 标签集合或活动标签变化后的统一广播：标题 + 标签条 + 正文。 */
function emitActiveDocument(): void {
  updateWindowTitle();
  pushTabs();
  send({ type: 'CONTENT_UPDATE', payload: { content: activeContent(), version: Date.now() } });
}

async function pickAndLoadFile(): Promise<string | null> {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }],
    // 一次选多个文件 → 一次开多个标签
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  for (const p of res.filePaths) loadFile(p);
  emitActiveDocument();
  return res.filePaths[res.filePaths.length - 1]!;
}

function readRecent(): RecentFileRecord[] {
  if (!store) return [];
  return parseRecentFiles(store.get(RECENT_STORE_KEY));
}

function writeRecent(list: RecentFileRecord[]): RecentFileRecord[] {
  if (store) store.set(RECENT_STORE_KEY, list);
  return list;
}

function readFileTreeRoot(): string {
  const raw = store?.get(FILE_TREE_ROOT_KEY);
  const saved = typeof raw === 'string' ? raw.trim() : '';
  if (!saved) return '';
  try {
    if (fs.existsSync(saved) && fs.statSync(saved).isDirectory()) return path.resolve(saved);
  } catch {
    /* ignore */
  }
  store?.delete(FILE_TREE_ROOT_KEY);
  return '';
}

/** 只接受真实存在的目录。非法路径不改已记住的根。 */
function commitFileTreeRoot(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return readFileTreeRoot();
  const resolved = path.resolve(trimmed);
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      store?.set(FILE_TREE_ROOT_KEY, resolved);
      return resolved;
    }
  } catch {
    /* ignore */
  }
  return readFileTreeRoot();
}

/** 取消对话框时返回 null，避免把「没选」当成一次刷新。 */
async function chooseFileTreeRoot(): Promise<string | null> {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const current = readFileTreeRoot();
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择文件夹',
    defaultPath: current || undefined,
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return commitFileTreeRoot(res.filePaths[0]);
}

function publishFileTreeRoot(root: string): void {
  if (!root) return;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:file-tree:root', root);
  }
}

function rememberRecent(p: string): void {
  if (!store || !p) return;
  writeRecent(upsertRecentFile(readRecent(), p, Date.now()));
}

/** 读盘并装入标签页（同路径复用、空白标签就地占用，见 tabs.openFileTab）。不负责广播。 */
function loadFile(p: string): void {
  let content: string;
  try {
    content = fs.readFileSync(p, 'utf-8');
  } catch (e) {
    content = `# 打开失败\n\n无法读取：\`${p}\`\n\n> ${String((e as Error)?.message ?? e)}`;
  }
  tabs = openFileTab(tabs, nextTabId(), p, content);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) rememberRecent(p);
  } catch {
    /* ignore */
  }
}

function openExistingPath(p: string): string | null {
  const raw = String(p ?? '').trim();
  if (!raw) return null;
  const resolved = path.resolve(raw);
  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      writeRecent(removeRecentFile(removeRecentFile(readRecent(), raw), resolved));
      return null;
    }
  } catch {
    return null;
  }
  loadFile(resolved);
  emitActiveDocument();
  return resolved;
}

function newBlankTab(): void {
  tabs = openBlankTab(tabs, nextTabId());
  emitActiveDocument();
}

function openSettings(): void {
  tabs = openSettingsTab(tabs, nextTabId());
  emitActiveDocument();
}

function prefersDark(): boolean {
  return nativeTheme.shouldUseDarkColors;
}

/** 外观设置落盘并广播；renderer 收到 CONFIG_CHANGE 后重出预览。 */
function updateAppearance(raw: unknown) {
  const patch = normalizeAppearancePatch(raw);
  if (patch) {
    if (patch.theme !== undefined) appConfig.editor.theme = patch.theme;
    if (patch.fontFamily !== undefined) appConfig.editor.fontFamily = patch.fontFamily;
    if (patch.fontSize !== undefined) {
      appConfig.editor.fontSize = patch.fontSize as ExtensionConfig['editor']['fontSize'];
    }
    saveAppConfigPatch({ editor: patch });
    send({ type: 'CONFIG_CHANGE', payload: { config: appConfig } });
  }
  return { ...readAppearance(appConfig), prefersDark: prefersDark() };
}

function selectTab(id: string): void {
  const before = tabs;
  tabs = activateTab(tabs, String(id ?? ''));
  if (tabs !== before) emitActiveDocument();
}

function dropTab(id: string): void {
  const before = tabs;
  tabs = closeTab(tabs, String(id ?? ''), nextTabId());
  if (tabs !== before) emitActiveDocument();
}

/**
 * 把 Markdown 源 + 预览 HTML 写入系统剪贴板。
 * renderer 传入已抽好的载荷；缺 html 时本地 markdownToHtml 兜底（菜单在预览未就绪时仍能复制）。
 */
async function writeDocumentClipboard(payload?: { text?: unknown; html?: unknown }): Promise<boolean> {
  let fallbackHtml = '';
  const needsFallback = !(typeof payload?.html === 'string' && payload.html.length > 0);
  if (needsFallback) {
    try {
      fallbackHtml = await markdownToHtml(activeContent());
    } catch {
      fallbackHtml = '';
    }
  }
  const write = normalizeCopyPayload(payload, activeContent(), fallbackHtml);
  clipboard.write({ text: write.text, html: write.html });
  return true;
}

function requestRendererCopy(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:copy-request');
    return;
  }
  void writeDocumentClipboard();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Markly',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  // 拦截 iframe 内 target=_blank 的新窗口请求，转交系统浏览器；renderer 负责给外部 <a> 加 target=_blank
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  // 拖文档到界面（含预览 iframe 内部）会触发文件 URL 导航：拦下来当「打开文档」处理；
  // 其它导航一律阻止——应用窗口不能被拖拽或链接带离自己的界面。
  const guardNavigation = (ev: { preventDefault: () => void }, url: string): void => {
    ev.preventDefault();
    if (!/^file:\/\//i.test(url)) return;
    let dropped = '';
    try {
      dropped = fileURLToPath(url);
    } catch {
      return;
    }
    if (isMarkdownFileName(dropped)) loadFile(dropped);
  };
  mainWindow.webContents.on('will-navigate', (ev, url) => guardNavigation(ev, url));
  // 沙箱 iframe 里落下文件走的是 frame 级导航；老版本 Electron 没有该事件时自然不触发
  mainWindow.webContents.on(
    'will-frame-navigate' as never,
    ((ev: { preventDefault: () => void }, details: { url?: string }) =>
      guardNavigation(ev, String(details?.url ?? ''))) as never
  );
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  updateWindowTitle();
}

// macOS：通过 “用 Markly 打开” 触发；多选多个文件会连续触发多次，各自进一个标签
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (!app.isReady()) {
    // 冷启动：留给 app.whenReady() 消费（loadFile + createWindow）
    pendingFiles.push(p);
    return;
  }
  loadFile(p);
  // 主窗口被关掉后 darwin 下进程仍存活；此时 BrowserWindow 引用为销毁态，需要重建
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    emitActiveDocument();
  }
});

app.whenReady().then(() => {
  const stateDir = path.join(app.getPath('home'), '.markly');
  try {
    fs.mkdirSync(stateDir, { recursive: true });
  } catch {
    /* ignore */
  }
  store = new Store({ name: 'markly-state', cwd: stateDir });

  appConfig = loadAppConfig();

  // 初始文件来源：open-file 待处理 > 命令行 .md 参数 > 初始空白标签（占位正文见 tabs.BLANK_TAB_CONTENT）
  const argFiles = process.argv.filter((a) => a.endsWith('.md') && fs.existsSync(a));
  const initial = pendingFiles.length > 0 ? pendingFiles : argFiles;
  for (const p of initial) loadFile(p);
  pendingFiles = [];

  const bridge = createHostBridge({
    config: appConfig,
    store,
    sendToRenderer: send,
    getCurrentContent: () => activeContent(),
    getCurrentDocDir: () => {
      const p = activeFilePath();
      return p ? path.dirname(p) : process.cwd();
    },
    setCurrentContent: (s) => {
      tabs = setActiveContent(tabs, s);
    },
    getPrefersDark: prefersDark,
  });

  // 主题设为 auto 时，系统明暗切换要即时反映到预览与外壳
  nativeTheme.on('updated', () => {
    if (appConfig.editor.theme === 'auto') {
      send({ type: 'CONFIG_CHANGE', payload: { config: appConfig } });
    }
  });

  ipcMain.on('host:msg', (_e, msg) => {
    void bridge.handleMessage(msg);
  });
  ipcMain.on('host:store:get', (e, key) => {
    e.returnValue = store.get(key);
  });
  ipcMain.on('host:store:set', (e, key, val) => {
    store.set(key, val);
    e.returnValue = true;
  });
  ipcMain.handle('app:open-file', () => pickAndLoadFile());
  ipcMain.handle('app:open-path', (_e, filePath: unknown) =>
    openExistingPath(typeof filePath === 'string' ? filePath : '')
  );
  ipcMain.handle('app:recent-files:list', () => readRecent());
  ipcMain.handle('app:recent-files:remove', (_e, filePath: unknown) => {
    const p = typeof filePath === 'string' ? filePath : '';
    return writeRecent(removeRecentFile(readRecent(), p));
  });
  ipcMain.handle('app:recent-files:clear', () => {
    writeRecent([]);
    return [];
  });
  ipcMain.handle('app:file-tree:root', () => readFileTreeRoot());
  ipcMain.handle('app:file-tree:pick', () => chooseFileTreeRoot());
  ipcMain.handle('app:file-tree:set-root', (_e, raw: unknown) =>
    commitFileTreeRoot(typeof raw === 'string' ? raw : '')
  );
  ipcMain.handle('app:file-tree:list', (_e, dir: unknown) => {
    // 目录树从文件系统根铺开，不再限制在曾经选过的文件夹里。
    const target = typeof dir === 'string' ? dir.trim() : '';
    const root = filesystemRootOf(target);
    if (!root) return listFileTree('', '');
    return listFileTree(target, root);
  });
  ipcMain.handle('app:list-dir-markdown', (_e, payload?: { filePath?: unknown; offset?: unknown }) => {
    const filePath = typeof payload?.filePath === 'string' ? payload.filePath.trim() : '';
    const offset = typeof payload?.offset === 'number' && Number.isFinite(payload.offset) ? payload.offset : 0;
    const dir = filePath ? path.dirname(filePath) : '';
    return listMarkdownFilesPage(dir, offset, DIR_MD_PAGE_SIZE);
  });
  ipcMain.handle('app:copy-document', (_e, payload?: { text?: unknown; html?: unknown }) =>
    writeDocumentClipboard(payload)
  );
  ipcMain.on('host:current-file-path', (e) => {
    e.returnValue = activeFilePath();
  });

  // 标签页：renderer 只持有视图（id/title/filePath），增删切都回主进程改唯一状态源
  ipcMain.on('app:tabs:state', (e) => {
    e.returnValue = summarizeTabs(tabs);
  });
  ipcMain.handle('app:tabs:new', () => {
    newBlankTab();
    return summarizeTabs(tabs);
  });
  ipcMain.handle('app:tabs:activate', (_e, id: unknown) => {
    selectTab(typeof id === 'string' ? id : '');
    return summarizeTabs(tabs);
  });
  ipcMain.handle('app:tabs:close', (_e, id: unknown) => {
    dropTab(typeof id === 'string' ? id : '');
    return summarizeTabs(tabs);
  });
  ipcMain.handle('app:tabs:settings', () => {
    openSettings();
    return summarizeTabs(tabs);
  });

  // 外观设置：读当前值 + 落盘补丁
  ipcMain.on('app:settings:get', (e) => {
    e.returnValue = { ...readAppearance(appConfig), prefersDark: prefersDark() };
  });
  ipcMain.handle('app:settings:update', (_e, patch: unknown) => updateAppearance(patch));

  // 应用菜单：File → Open（Cmd/Ctrl+O）+ Edit（系统复制角色，否则 macOS 上 Cmd+C 无效）
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                { label: '设置…', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
                { type: 'separator' as const },
                { role: 'quit' as const },
              ],
            },
          ]
        : []),
      {
        label: 'File',
        submenu: [
          { label: '新建标签页', accelerator: 'CmdOrCtrl+T', click: () => newBlankTab() },
          { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => void pickAndLoadFile() },
          {
            label: '打开文件夹…',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => {
              void chooseFileTreeRoot().then((picked) => {
                if (picked) publishFileTreeRoot(picked);
              });
            },
          },
          { type: 'separator' },
          { label: '设置…', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
          { type: 'separator' },
          // Cmd/Ctrl+W 关标签（标签式应用惯例）；关窗口退到 Shift+Cmd/Ctrl+W
          { label: '关闭标签页', accelerator: 'CmdOrCtrl+W', click: () => dropTab(tabs.activeId) },
          // 非 mac 保留 role 自带的 Ctrl+Q 退出，不挪到 Shift+Ctrl+W
          isMac
            ? { label: '关闭窗口', accelerator: 'Shift+CmdOrCtrl+W', role: 'close' as const }
            : { role: 'quit' as const },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' as const },
          { role: 'redo' as const },
          { type: 'separator' as const },
          { role: 'cut' as const },
          { role: 'copy' as const },
          { role: 'paste' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: '复制全文',
            accelerator: 'CmdOrCtrl+Shift+C',
            click: () => requestRendererCopy(),
          },
        ],
      },
    ])
  );

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
