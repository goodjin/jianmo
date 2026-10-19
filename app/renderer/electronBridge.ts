import type { DirMarkdownPage } from '../electron/dirMarkdown';
import type { RecentFileRecord } from '../electron/recentFiles';
import type { TabSummary } from '../electron/tabs';
import type { AppearanceSettings } from '../electron/appearance';
import {
  DEFAULT_FONT_SIZE,
  normalizeFontFamily,
  normalizeFontSize,
  normalizeTheme,
  parseSystemFontList,
} from '../electron/appearance';

/** 设置页用的外观状态：三项设置 + 系统明暗（auto 时决定实际配色）。 */
export interface AppearanceState extends AppearanceSettings {
  prefersDark: boolean;
}

export interface TabsView {
  tabs: TabSummary[];
  activeId: string;
}

export interface ElectronAppBridge {
  openFile?: () => Promise<string | null>;
  openPath?: (filePath: string) => Promise<string | null>;
  reloadDocument?: () => Promise<unknown>;
  saveDocument?: () => Promise<unknown>;
  settleEdits?: () => Promise<unknown>;
  setEditing?: (on: boolean) => void;
  onEditCommand?: (handler: (command: string) => void) => () => void;
  currentFilePath?: () => string | null;
  copyToClipboard?: (payload: { text: string; html: string }) => Promise<boolean>;
  exportDocument?: (format: 'pdf' | 'html') => Promise<unknown>;
  copyExactText?: (text: string) => Promise<boolean>;
  copySelection?: (payload: { text: string }) => Promise<boolean>;
  onCopyRequest?: (handler: () => void) => () => void;
  listRecentFiles?: () => Promise<unknown>;
  removeRecentFile?: (filePath: string) => Promise<unknown>;
  clearRecentFiles?: () => Promise<unknown>;
  listDirMarkdown?: (payload: { filePath: string; offset?: number }) => Promise<DirMarkdownPage | unknown>;
  fileTreeRoot?: () => Promise<unknown>;
  pickFileTreeRoot?: () => Promise<unknown>;
  setFileTreeRoot?: (dir: string) => Promise<unknown>;
  listFileTree?: (dir: string) => Promise<unknown>;
  revealInFolder?: (filePath: string) => Promise<boolean>;
  renameFile?: (from: string, name: string) => Promise<unknown>;
  trashFile?: (filePath: string) => Promise<unknown>;
  onFileTreeRoot?: (handler: (root: string) => void) => () => void;
  tabsState?: () => unknown;
  newTab?: () => Promise<unknown>;
  activateTab?: (id: string) => Promise<unknown>;
  closeTab?: (id: string) => Promise<unknown>;
  onTabsChanged?: (handler: (view: unknown) => void) => () => void;
  openSettingsTab?: () => Promise<unknown>;
  getAppearance?: () => unknown;
  updateAppearance?: (patch: Partial<AppearanceState>) => Promise<unknown>;
  listSystemFonts?: () => Promise<unknown>;
  getReaderPrefs?: () => unknown;
  updateReaderPrefs?: (patch: { copyOnSelect: boolean }) => Promise<unknown>;
  storeGet?: (key: string) => unknown;
  storeSet?: (key: string, val: unknown) => void;
}

export type { DirMarkdownPage, RecentFileRecord, TabSummary, AppearanceSettings };

/** 主进程回来的外观状态是跨 IPC 的 unknown，逐项校验后再进 UI。 */
export function parseAppearance(raw: unknown, installed?: readonly string[]): AppearanceState {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fromPayload = Array.isArray(obj.systemFonts) ? parseSystemFontList(obj.systemFonts) : undefined;
  const known = installed !== undefined ? installed : fromPayload;
  return {
    theme: normalizeTheme(obj.theme),
    fontFamily: normalizeFontFamily(obj.fontFamily, known),
    fontSize: typeof obj.fontSize === 'number' ? normalizeFontSize(obj.fontSize) : DEFAULT_FONT_SIZE,
    prefersDark: obj.prefersDark === true,
  };
}

/** 主进程推来的标签视图是跨 IPC 的 unknown，进 UI 前先收敛成可渲染结构。 */
export function parseTabsView(raw: unknown): TabsView {
  if (!raw || typeof raw !== 'object') return { tabs: [], activeId: '' };
  const obj = raw as { tabs?: unknown; activeId?: unknown };
  const tabs: TabSummary[] = Array.isArray(obj.tabs)
    ? obj.tabs.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const t = item as { id?: unknown; kind?: unknown; title?: unknown; filePath?: unknown };
        const id = typeof t.id === 'string' ? t.id : '';
        if (!id) return [];
        return [
          {
            id,
            kind: t.kind === 'settings' ? ('settings' as const) : ('doc' as const),
            title: typeof t.title === 'string' && t.title ? t.title : '新标签页',
            filePath: typeof t.filePath === 'string' ? t.filePath : '',
            dirty: t.dirty === true,
          },
        ];
      })
    : [];
  const activeId = typeof obj.activeId === 'string' ? obj.activeId : '';
  return { tabs, activeId };
}

export function electronApp(): ElectronAppBridge | undefined {
  return (window as unknown as { electron?: ElectronAppBridge }).electron;
}
