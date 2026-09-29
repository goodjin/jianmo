/**
 * 多标签页文档状态：纯函数，不碰 electron / fs。
 *
 * 主进程持有唯一一份 TabsState，活动标签决定 currentContent / currentFilePath，
 * 因此 hostBridge（预览渲染、图片内联、保存）无需感知标签的存在。
 */

import { displayNameFromPath } from '../renderer/documentMeta';

export const BLANK_TAB_TITLE = '新标签页';
export const SETTINGS_TAB_TITLE = '设置';

/** 空白标签正文。故意不用 `#` heading，避免 generateToc() 产出一个无意义的"Markly"锚点链接。 */
export const BLANK_TAB_CONTENT =
  '**Markly** · 独立 Markdown 查看编辑器\n\n从左侧 **文件** 栏选择文件夹，在目录树里点开文档；或用 **File → 打开…**（`Cmd/Ctrl+O`）直接选择一个 `.md` 文件。';

/** doc 承载 Markdown 文档；settings 是应用内设置页，全局至多一个。 */
export type TabKind = 'doc' | 'settings';

export interface DocTab {
  id: string;
  kind: TabKind;
  /** 空串表示尚未关联文件的空白标签；settings 恒为空 */
  filePath: string;
  content: string;
}

export interface TabsState {
  tabs: DocTab[];
  activeId: string;
}

/** 推送给 renderer 的轻量视图：不含正文，避免大文档随每次标签变化过 IPC。 */
export interface TabSummary {
  id: string;
  kind: TabKind;
  title: string;
  filePath: string;
}

let idSeq = 0;

export function nextTabId(): string {
  idSeq += 1;
  return `tab-${Date.now().toString(36)}-${idSeq.toString(36)}`;
}

export function tabTitle(filePath: string): string {
  const { fileName } = displayNameFromPath(filePath);
  return fileName || BLANK_TAB_TITLE;
}

/** 只有"还没装文档的文档标签"算空白；设置页不会被打开文件顶掉。 */
export function isBlankTab(tab: DocTab | null | undefined): boolean {
  return !!tab && tab.kind === 'doc' && tab.filePath === '';
}

export function createBlankTab(id: string): DocTab {
  return { id, kind: 'doc', filePath: '', content: BLANK_TAB_CONTENT };
}

export function createSettingsTab(id: string): DocTab {
  return { id, kind: 'settings', filePath: '', content: '' };
}

/** 标签条与窗口标题上显示的名字。 */
export function tabDisplayTitle(tab: DocTab): string {
  return tab.kind === 'settings' ? SETTINGS_TAB_TITLE : tabTitle(tab.filePath);
}

export function createInitialState(id: string): TabsState {
  return { tabs: [createBlankTab(id)], activeId: id };
}

export function getActiveTab(state: TabsState): DocTab | null {
  return state.tabs.find((t) => t.id === state.activeId) ?? null;
}

export function activateTab(state: TabsState, id: string): TabsState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  if (state.activeId === id) return state;
  return { tabs: state.tabs, activeId: id };
}

/** 新建空白标签并激活；id 与现有标签冲突时原样返回，避免产生重复 key。 */
export function openBlankTab(state: TabsState, id: string): TabsState {
  if (!id || state.tabs.some((t) => t.id === id)) return state;
  return { tabs: [...state.tabs, createBlankTab(id)], activeId: id };
}

/**
 * 把文件装入标签：
 * 1. 已有同路径标签 → 激活它并刷新正文（磁盘内容可能已变）；
 * 2. 当前是空白标签 → 就地占用，这样"+ 新建空白页再打开"不会多留一个空标签；
 * 3. 其余情况 → 追加新标签并激活。
 */
export function openFileTab(
  state: TabsState,
  id: string,
  filePath: string,
  content: string
): TabsState {
  const p = String(filePath ?? '').trim();
  if (!p) return state;

  const existing = state.tabs.find((t) => t.filePath === p);
  if (existing) {
    return {
      tabs: state.tabs.map((t) => (t.id === existing.id ? { ...t, content } : t)),
      activeId: existing.id,
    };
  }

  const active = getActiveTab(state);
  if (isBlankTab(active)) {
    return {
      tabs: state.tabs.map((t) => (t.id === active!.id ? { ...t, filePath: p, content } : t)),
      activeId: active!.id,
    };
  }

  if (!id || state.tabs.some((t) => t.id === id)) return state;
  return { tabs: [...state.tabs, { id, kind: 'doc', filePath: p, content }], activeId: id };
}

/** 设置页全局唯一：已存在就激活它，否则追加一个并激活。 */
export function openSettingsTab(state: TabsState, id: string): TabsState {
  const existing = state.tabs.find((t) => t.kind === 'settings');
  if (existing) return activateTab(state, existing.id);
  if (!id || state.tabs.some((t) => t.id === id)) return state;
  return { tabs: [...state.tabs, createSettingsTab(id)], activeId: id };
}

/**
 * 关闭标签。关掉的是活动标签时接管右邻，没有右邻则接管左邻；
 * 关掉最后一个标签时留一个新的空白标签，窗口不会变成空壳。
 */
export function closeTab(state: TabsState, id: string, blankId: string): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return state;

  const tabs = state.tabs.filter((t) => t.id !== id);
  if (tabs.length === 0) return createInitialState(blankId);
  if (state.activeId !== id) return { tabs, activeId: state.activeId };

  const nextActive = tabs[idx] ?? tabs[idx - 1] ?? tabs[0]!;
  return { tabs, activeId: nextActive.id };
}

/** 活动标签正文回写（CONTENT_CHANGE / SAVE）。无活动标签时原样返回。 */
export function setActiveContent(state: TabsState, content: string): TabsState {
  if (!getActiveTab(state)) return state;
  return {
    tabs: state.tabs.map((t) => (t.id === state.activeId ? { ...t, content } : t)),
    activeId: state.activeId,
  };
}

export function summarizeTabs(state: TabsState): { tabs: TabSummary[]; activeId: string } {
  return {
    tabs: state.tabs.map((t) => ({
      id: t.id,
      kind: t.kind,
      title: tabDisplayTitle(t),
      filePath: t.filePath,
    })),
    activeId: state.activeId,
  };
}
