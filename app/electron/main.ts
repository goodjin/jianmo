import { app, BrowserWindow, clipboard, ipcMain, dialog, Menu, nativeTheme, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createHostBridge } from './hostBridge';
import { loadAppConfig, saveAppConfigPatch } from './config';
import { normalizeAppearancePatch, normalizeFontFamily, readAppearance } from './appearance';
import { getInstalledFontFamilies, listInstalledFontFamilies } from './systemFonts';
import { markdownToHtml } from '../../src/core/export/htmlExport';
import { isOpenableDocumentName } from './documentKind';
import { readFailureDetail } from './macFolderAccess';
import { normalizeCopyPayload } from './copyPayload';
import {
  exportMarkdownDocument,
  isAppExportFormat,
  suggestExportPath,
  type ExportIpcResult,
} from './exportDocument';
import { printHtmlToPdfFile } from './printPdf';
import { normalizeReaderPatch, readReaderPrefs, type ReaderPrefs } from './readerPrefs';
import { toSelectionClipboardText } from './selectionCopy';
import { listMarkdownFilesPage } from './dirMarkdown';
import { listFileTree } from './fileTree';
import { filesystemRootOf } from './fileTreeModel';
import {
  bindWindowRevealEvents,
  handleAppActivate,
  handleExternalFileOpen,
  revealAppWindow,
  scheduleHiddenWindowReveal,
} from './fileOpenWindow';
import {
  DIR_MD_PAGE_SIZE,
  parseRecentFiles,
  removeRecentFile,
  renameRecentFile,
  upsertRecentFile,
  type RecentFileRecord,
} from './recentFiles';
import { resolveFileTreeRoot } from './fileTreeModel';
import { applyFileRename, destinationTaken } from './fileRename';
import {
  activateTab,
  closeTab,
  createInitialState,
  getActiveTab,
  nextTabId,
  openBlankTab,
  openFileTab,
  openSettingsTab,
  renameFileInTabs,
  setActiveContent,
  summarizeTabs,
  tabDisplayTitle,
  type TabsState,
} from './tabs';
import type { ExtensionConfig, ExtensionMessage } from '../../src/types';

const RECENT_STORE_KEY = 'recentFiles';
const FILE_TREE_ROOT_KEY = 'fileTreeRoot';

let mainWindow: BrowserWindow | null = null;
let exportBusy = false;
/** 唯一文档状态源：活动标签即"当前文档"，hostBridge 因此无需感知标签。 */
let tabs: TabsState = createInitialState(nextTabId());
let pendingFiles: string[] = [];
let store: Store;
/** hostBridge 持有同一个对象引用，改这里的字段即刻影响下一次预览渲染。 */
let appConfig: ExtensionConfig;
/** 阅读偏好：选择即复制。和 appConfig 一起从 ~/.markly/config.json 读出。 */
let readerPrefs: ReaderPrefs = { copyOnSelect: true };

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
    title: '打开文件',
    filters: [
      { name: 'Markdown / JSON', extensions: ['md', 'markdown', 'mdx', 'json', 'jsonl'] },
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] },
      { name: 'JSON', extensions: ['json', 'jsonl'] },
    ],
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

function directoryExists(dir: string): boolean {
  try {
    return !!dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function homeDir(): string {
  try {
    return app.getPath('home');
  } catch {
    return '';
  }
}

/** 没选过文件夹时，目录树从用户主目录开始，而不是整块磁盘。 */
function readFileTreeRoot(): string {
  const raw = store?.get(FILE_TREE_ROOT_KEY);
  const saved = typeof raw === 'string' ? raw.trim() : '';
  if (saved && !directoryExists(saved)) store?.delete(FILE_TREE_ROOT_KEY);
  const resolved = resolveFileTreeRoot(
    saved && directoryExists(saved) ? saved : '',
    homeDir(),
    directoryExists
  );
  return resolved ? path.resolve(resolved) : '';
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
    content = `# 打开失败\n\n无法读取：\`${p}\`\n\n> ${readFailureDetail(p, e)}`;
  }
  tabs = openFileTab(tabs, nextTabId(), p, content);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) rememberRecent(p);
  } catch {
    /* ignore */
  }
}

/** 改名后标签和最近打开都换成新路径，窗口标题跟着变。 */
function renameOpenedFile(from: string, nextName: string): { ok: boolean; path: string; error: string } {
  const result = applyFileRename(from, nextName, {
    taken: (dest) =>
      destinationTaken(
        from,
        dest,
        (p) => {
          try {
            return fs.existsSync(p);
          } catch {
            return true;
          }
        },
        (a, b) => fs.realpathSync(a) === fs.realpathSync(b)
      ),
    isFile: (p) => {
      try {
        return fs.existsSync(p) && fs.statSync(p).isFile();
      } catch {
        return false;
      }
    },
    rename: (a, b) => {
      try {
        fs.renameSync(a, b);
      } catch (error) {
        throw new Error(readFailureDetail(a, error));
      }
    },
  });
  if (!result.ok) return { ok: false, path: from, error: result.error };
  if (!result.unchanged) {
    tabs = renameFileInTabs(tabs, result.from, result.to);
    writeRecent(renameRecentFile(readRecent(), result.from, result.to));
    emitActiveDocument();
  }
  return { ok: true, path: result.to, error: '' };
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

function appearanceState(): Record<string, unknown> {
  const installed = getInstalledFontFamilies();
  return {
    ...readAppearance(appConfig, installed),
    prefersDark: prefersDark(),
    ...(installed !== undefined ? { systemFonts: [...installed] } : {}),
  };
}

/** 字体列表到了之后，记住的系统字体若这台电脑没有，就改回思源黑体。 */
function reconcileStoredReadingFont(installed: readonly string[]): void {
  const next = normalizeFontFamily(appConfig.editor.fontFamily, installed);
  if (next === appConfig.editor.fontFamily) return;
  appConfig.editor.fontFamily = next;
  saveAppConfigPatch({ editor: { fontFamily: next } });
  send({ type: 'CONFIG_CHANGE', payload: { config: appConfig } });
}

/** 外观设置落盘并广播；renderer 收到 CONFIG_CHANGE 后重出预览。 */
function updateAppearance(raw: unknown) {
  const patch = normalizeAppearancePatch(raw, getInstalledFontFamilies());
  if (patch) {
    if (patch.theme !== undefined) appConfig.editor.theme = patch.theme;
    if (patch.fontFamily !== undefined) appConfig.editor.fontFamily = patch.fontFamily;
    if (patch.fontSize !== undefined) {
      appConfig.editor.fontSize = patch.fontSize as ExtensionConfig['editor']['fontSize'];
    }
    saveAppConfigPatch({ editor: patch });
    send({ type: 'CONFIG_CHANGE', payload: { config: appConfig } });
  }
  return appearanceState();
}

function updateReaderPrefs(raw: unknown): ReaderPrefs {
  const patch = normalizeReaderPatch(raw);
  if (patch) {
    readerPrefs = { ...readerPrefs, ...patch };
    saveAppConfigPatch({ reader: { copyOnSelect: readerPrefs.copyOnSelect } });
    installAppMenu();
  }
  return { ...readerPrefs };
}

function writeSelectionClipboard(payload: unknown): boolean {
  const text = toSelectionClipboardText(payload);
  if (!text) return false;
  clipboard.writeText(text);
  return true;
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

function exportFailureMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? '');
  return text.trim() || '导出失败';
}

async function reportExportError(error: string): Promise<ExportIpcResult> {
  console.error('[Markly] export failed', error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: '导出失败',
      message: '导出失败',
      detail: error,
    });
  }
  return { ok: false, error };
}

/**
 * 弹出保存对话框，HTML 写文件，PDF 用隐藏窗口打印。
 * 取消不提示；失败弹错误框，并把结果交回按钮（菜单调用时同样弹框）。
 */
async function runExport(format: unknown): Promise<ExportIpcResult> {
  if (!isAppExportFormat(format)) return reportExportError('请选择 PDF 或 HTML');
  const tab = getActiveTab(tabs);
  if (!tab || tab.kind === 'settings') return reportExportError('设置页不能导出');
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: '窗口不可用' };
  if (exportBusy) return reportExportError('正在导出，请稍候');

  exportBusy = true;
  try {
    const documentsDir = app.getPath('documents');
    const suggested = suggestExportPath(tab.filePath || null, format, documentsDir);
    const picked = await dialog.showSaveDialog(mainWindow, {
      title: format === 'pdf' ? '导出 PDF' : '导出 HTML',
      defaultPath: suggested,
      filters: [{ name: format === 'pdf' ? 'PDF' : 'HTML', extensions: [format] }],
    });
    if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true };

    const outputPath = await exportMarkdownDocument({
      format,
      markdown: tab.content,
      tabKind: 'doc',
      sourcePath: tab.filePath || null,
      outputPath: picked.filePath,
      documentDir: tab.filePath ? path.dirname(tab.filePath) : '',
      includeToc: format === 'pdf' ? appConfig.export.pdf.includeToc !== false : true,
      htmlTheme: appConfig.export.html?.theme === 'print-friendly' ? 'print-friendly' : 'default',
      copyLocalImages: appConfig.export.html?.copyLocalImages !== false,
      assetsSubdirectory: appConfig.export.html?.assetsSubdirectory,
      mermaidScriptBundling:
        appConfig.export.diagram?.mermaidScriptBundling === 'external' ? 'external' : 'embedded',
      pdf: appConfig.export.pdf,
      printPdf: printHtmlToPdfFile,
    });
    return { ok: true, path: outputPath, format };
  } catch (error) {
    return reportExportError(exportFailureMessage(error));
  } finally {
    exportBusy = false;
  }
}

function requestRendererCopy(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:copy-request');
    return;
  }
  void writeDocumentClipboard();
}

function installAppMenu(): void {
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
          { label: '导出 HTML…', click: () => void runExport('html') },
          { label: '导出 PDF…', click: () => void runExport('pdf') },
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
          { type: 'separator' as const },
          {
            label: '选择即复制',
            type: 'checkbox' as const,
            checked: readerPrefs.copyOnSelect,
            click: (item) => {
              updateReaderPrefs({ copyOnSelect: item.checked });
            },
          },
        ],
      },
    ])
  );
}

function hasLiveMainWindow(): boolean {
  return !!mainWindow && !mainWindow.isDestroyed();
}

/** 把主窗口显示出来并拿到前台。窗口已经在前面时只是再聚焦一次。 */
function revealMainWindow(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  revealAppWindow(win, app, process.platform);
}

function attachForegroundRecovery(win: BrowserWindow): void {
  const revealThis = (): void => {
    if (mainWindow !== win || win.isDestroyed()) return;
    revealMainWindow();
  };
  // 第一次 show 若发生在应用还没激活时，macOS 会把它丢掉；加载完成和稍后补一次。
  bindWindowRevealEvents(win, revealThis);
  scheduleHiddenWindowReveal(
    () => mainWindow === win && !win.isDestroyed() && (!win.isVisible() || win.isMinimized()),
    (delayMs) => {
      if (delayMs > 0) console.error('[Markly] 窗口仍未显示，再次拉到前台');
      revealThis();
    },
    (fn, ms) => {
      setTimeout(fn, ms);
    },
    process.platform
  );
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Markly',
    // 等内容能画出来再显示。macOS 从访达打开时，构造函数里立刻显示经常不会出现在屏幕上。
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const created = mainWindow;
  created.on('closed', () => {
    if (mainWindow === created) mainWindow = null;
  });
  attachForegroundRecovery(created);
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
    if (isOpenableDocumentName(dropped)) loadFile(dropped);
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
  handleExternalFileOpen(p, {
    appReady: app.isReady(),
    hasLiveWindow: hasLiveMainWindow(),
    // 冷启动：留给 app.whenReady() 消费（loadFile + createWindow）
    queueFile: (filePath) => pendingFiles.push(filePath),
    loadFile,
    createWindow,
    emitActiveDocument,
    revealWindow: revealMainWindow,
  });
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
  readerPrefs = readReaderPrefs(appConfig);
  void listInstalledFontFamilies()
    .then((installed) => reconcileStoredReadingFont(installed))
    .catch((err) => console.warn('[markly] 枚举系统字体失败', err));

  // 初始文件来源：open-file 待处理 > 命令行文档参数 > 初始空白标签（占位正文见 tabs.BLANK_TAB_CONTENT）
  const argFiles = process.argv.filter((a) => isOpenableDocumentName(a) && fs.existsSync(a));
  const initial = pendingFiles.length > 0 ? pendingFiles : argFiles;
  for (const p of initial) loadFile(p);
  pendingFiles = [];

  const bridge = createHostBridge({
    config: appConfig,
    store,
    sendToRenderer: send,
    getCurrentContent: () => activeContent(),
    getCurrentFilePath: () => activeFilePath(),
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
  ipcMain.handle('app:reveal-in-folder', (_e, filePath: unknown) => {
    const raw = typeof filePath === 'string' ? filePath.trim() : '';
    if (!raw) return false;
    shell.showItemInFolder(path.resolve(raw));
    return true;
  });
  ipcMain.handle('app:rename-file', (_e, payload: unknown) => {
    const obj = payload && typeof payload === 'object' ? (payload as { from?: unknown; name?: unknown }) : {};
    const from = typeof obj.from === 'string' ? obj.from : '';
    const name = typeof obj.name === 'string' ? obj.name : '';
    return renameOpenedFile(from, name);
  });
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
  ipcMain.handle('app:export-document', (_e, format: unknown) => runExport(format));
  // 圆角框点选：原文写入剪贴板，空字符串也要能复制，不能退回整篇文档
  ipcMain.handle('app:copy-text', (_e, text: unknown) => {
    if (typeof text !== 'string') return false;
    clipboard.writeText(text);
    return true;
  });
  ipcMain.handle('app:copy-selection', (_e, payload: unknown) => writeSelectionClipboard(payload));
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
    e.returnValue = appearanceState();
  });
  ipcMain.handle('app:settings:update', (_e, patch: unknown) => updateAppearance(patch));
  ipcMain.handle('app:fonts:list', () => listInstalledFontFamilies());
  ipcMain.on('app:reader:get', (e) => {
    e.returnValue = { ...readerPrefs };
  });
  ipcMain.handle('app:reader:update', (_e, patch: unknown) => updateReaderPrefs(patch));

  // 应用菜单：File → Open（Cmd/Ctrl+O）+ Edit（系统复制角色，否则 macOS 上 Cmd+C 无效）
  installAppMenu();

  // open-file 若赶在本回调之前已经建过窗口，这里不能再盖一个空白窗口。
  // 那种窗口可能先起来、文件稍后才读进标签，所以要再推一次正文。
  if (hasLiveMainWindow()) {
    emitActiveDocument();
    revealMainWindow();
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // 点程序坞，或系统在启动后把应用变为当前应用。ready 之前不能创建窗口。
  handleAppActivate({
    appReady: app.isReady(),
    hasLiveWindow: hasLiveMainWindow(),
    createWindow,
    revealWindow: revealMainWindow,
  });
});
