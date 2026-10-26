/**
 * 多标签页文档状态：纯函数，不碰 electron / fs。
 *
 * 主进程持有唯一一份 TabsState，活动标签决定 currentContent / currentFilePath，
 * 因此 hostBridge（预览渲染、图片内联、保存）无需感知标签的存在。
 */

import { displayNameFromPath } from '../renderer/documentMeta';

export const BLANK_TAB_TITLE = '新标签页';
export const SETTINGS_TAB_TITLE = '设置';

/** 新标签页上的简介。不用 `#` 标题，避免预览里多出一个空锚点。 */
export const WELCOME_TITLE = 'Markly';
export const WELCOME_LEAD = '干净、好读的文档查看器。';
export const WELCOME_LINES = [
  '左边是文件。Markdown、JSON，以及日志、配置、密钥这类文本都能打开，也可以把文件拖进窗口。',
  '右上角有源码、刷新和编辑。复制浮在正文右上角。导出和设置在最右边三个点的菜单里。',
] as const;

export const WELCOME_REPO = 'https://github.com/goodjin/jianmo';
export const WELCOME_EMAIL = 'goodjin2@gmail.com';
export const WELCOME_REPO_LABEL = '仓库地址';
export const WELCOME_EMAIL_LABEL = '联系邮箱';

export const BLANK_TAB_CONTENT = [
  `**${WELCOME_TITLE}**`,
  '',
  WELCOME_LEAD,
  '',
  WELCOME_LINES[0],
  '',
  WELCOME_LINES[1],
  '',
  `${WELCOME_REPO_LABEL}：${WELCOME_REPO}`,
  '',
  `${WELCOME_EMAIL_LABEL}：${WELCOME_EMAIL}`,
].join('\n');

/** doc 承载打开的文档；settings 是应用内设置页，全局至多一个。 */
export type TabKind = 'doc' | 'settings';

export interface DocTab {
  id: string;
  kind: TabKind;
  /** 空串表示尚未关联文件的空白标签；settings 恒为空 */
  filePath: string;
  content: string;
  /**
   * 上次从磁盘读入或成功写入的正文。
   * 缺省时视为与 content 相同（还没改过）。第一次改字时会把改之前的正文冻在这里。
   */
  savedContent?: string;
  /** 打开或保存时读到的修改时间。空白页、还没对上磁盘时为 null。 */
  diskMtimeMs?: number | null;
  /** 最近一次被看到的时间。越大越新。没记过的当成最早。 */
  lastViewedAt?: number;
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
  /** 正文和上次保存的不一样。设置页恒为 false。 */
  dirty: boolean;
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
  return {
    id,
    kind: 'doc',
    filePath: '',
    content: BLANK_TAB_CONTENT,
    savedContent: BLANK_TAB_CONTENT,
    diskMtimeMs: null,
  };
}

export function createSettingsTab(id: string): DocTab {
  return { id, kind: 'settings', filePath: '', content: '', savedContent: '', diskMtimeMs: null };
}

/** 没单独记过基线时，当前正文就算已保存。 */
export function savedBaseline(tab: DocTab): string {
  return tab.savedContent ?? tab.content;
}

export function isTabDirty(tab: DocTab | null | undefined): boolean {
  return !!tab && tab.kind === 'doc' && tab.content !== savedBaseline(tab);
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

/** 记下这个标签刚刚被看到。未知 id 原样返回。 */
export function noteTabViewed(state: TabsState, id: string, now: number): TabsState {
  if (!id || !state.tabs.some((t) => t.id === id)) return state;
  const when = Number.isFinite(now) ? now : 0;
  return {
    tabs: state.tabs.map((t) => (t.id === id ? { ...t, lastViewedAt: when } : t)),
    activeId: state.activeId,
  };
}

/**
 * 除了正在看的那一张，最久没有查看的标签。
 * 时间相同就关更靠左的那张。只剩正在看的时返回 null，不会把窗口关空。
 */
export function leastRecentlyViewedId(state: TabsState): string | null {
  const rest = state.tabs.filter((t) => t.id !== state.activeId);
  if (rest.length === 0) return null;
  let best = rest[0]!;
  let bestAt = best.lastViewedAt ?? 0;
  let bestIndex = state.tabs.indexOf(best);
  for (let i = 1; i < rest.length; i += 1) {
    const tab = rest[i]!;
    const at = tab.lastViewedAt ?? 0;
    const index = state.tabs.indexOf(tab);
    if (at < bestAt || (at === bestAt && index < bestIndex)) {
      best = tab;
      bestAt = at;
      bestIndex = index;
    }
  }
  return best.id;
}

/** 新建空白标签并激活；id 与现有标签冲突时原样返回，避免产生重复 key。 */
export function openBlankTab(state: TabsState, id: string): TabsState {
  if (!id || state.tabs.some((t) => t.id === id)) return state;
  return { tabs: [...state.tabs, createBlankTab(id)], activeId: id };
}

/**
 * 把文件装入标签：
 * 1. 已有同路径标签 → 激活它并刷新正文（磁盘内容可能已变）。
 *    当前若是空标签，这篇已经在别处打开，这张空标签用不上，关掉它。
 * 2. 当前是空白标签 → 就地占用，这样「+ 新建空白页再打开」不会多留一个空标签。
 *    只有当前这张是空的才占用；别的空标签不动。
 * 3. 其余情况 → 追加新标签并激活。
 */
export function openFileTab(
  state: TabsState,
  id: string,
  filePath: string,
  content: string,
  diskMtimeMs: number | null = null
): TabsState {
  const p = String(filePath ?? '').trim();
  if (!p) return state;

  const existing = state.tabs.find((t) => t.filePath === p);
  if (existing) {
    const active = getActiveTab(state);
    const dropBlank = isBlankTab(active) && active.id !== existing.id ? active.id : '';
    return {
      tabs: state.tabs
        .filter((t) => t.id !== dropBlank)
        .map((t) =>
          t.id === existing.id ? { ...t, content, savedContent: content, diskMtimeMs } : t
        ),
      activeId: existing.id,
    };
  }

  const active = getActiveTab(state);
  if (isBlankTab(active)) {
    return {
      tabs: state.tabs.map((t) =>
        t.id === active!.id ? { ...t, filePath: p, content, savedContent: content, diskMtimeMs } : t
      ),
      activeId: active!.id,
    };
  }

  if (!id || state.tabs.some((t) => t.id === id)) return state;
  return {
    tabs: [...state.tabs, { id, kind: 'doc', filePath: p, content, savedContent: content, diskMtimeMs }],
    activeId: id,
  };
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

/**
 * 文件进了废纸篓后，关掉所有打开它的标签。
 * 一个都没打开时原样返回。全部关掉时留一个空白标签。
 */
export function closeTabsForPath(state: TabsState, filePath: string, blankId: string): TabsState {
  const target = String(filePath ?? '').trim();
  if (!target) return state;
  const ids = state.tabs.filter((tab) => tab.kind === 'doc' && tab.filePath === target).map((tab) => tab.id);
  if (ids.length === 0) return state;
  let next = state;
  for (const id of ids) next = closeTab(next, id, blankId);
  return next;
}

/**
 * 磁盘上的文件改名后，已打开的标签跟着换路径。正文不动。
 * 没有这个路径的标签时原样返回。
 */
export function renameFileInTabs(state: TabsState, fromPath: string, toPath: string): TabsState {
  const from = String(fromPath ?? '').trim();
  const to = String(toPath ?? '').trim();
  if (!from || !to || from === to) return state;
  if (!state.tabs.some((tab) => tab.filePath === from)) return state;
  return {
    tabs: state.tabs.map((tab) => (tab.filePath === from ? { ...tab, filePath: to } : tab)),
    activeId: state.activeId,
  };
}

/**
 * 活动标签正文回写（编辑器打字）。无活动标签时原样返回。
 * 第一次和基线分叉时，把改之前的正文冻成 savedContent，这样改回去就不算未保存。
 */
export function setActiveContent(state: TabsState, content: string): TabsState {
  if (!getActiveTab(state)) return state;
  return {
    tabs: state.tabs.map((t) => {
      if (t.id !== state.activeId) return t;
      return { ...t, content, savedContent: savedBaseline(t) };
    }),
    activeId: state.activeId,
  };
}

/** 保存成功：基线跟上正文，并记下路径和修改时间。 */
export function markTabSaved(state: TabsState, id: string, filePath: string, mtimeMs: number): TabsState {
  const pathName = String(filePath ?? '').trim();
  if (!pathName || !state.tabs.some((t) => t.id === id && t.kind === 'doc')) return state;
  return {
    tabs: state.tabs.map((t) =>
      t.id === id ? { ...t, filePath: pathName, savedContent: t.content, diskMtimeMs: mtimeMs } : t
    ),
    activeId: state.activeId,
  };
}

/** 用磁盘上的正文替换标签，并把它当成已保存。刷新和「重新打开」走这里。 */
export function adoptDiskContent(
  state: TabsState,
  id: string,
  content: string,
  mtimeMs: number | null
): TabsState {
  if (!state.tabs.some((t) => t.id === id && t.kind === 'doc')) return state;
  return {
    tabs: state.tabs.map((t) =>
      t.id === id ? { ...t, content, savedContent: content, diskMtimeMs: mtimeMs } : t
    ),
    activeId: state.activeId,
  };
}

/** 放弃未保存的修改，正文回到上次保存的那一版。 */
export function revertTabContent(state: TabsState, id: string): TabsState {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab || tab.kind !== 'doc' || !isTabDirty(tab)) return state;
  return {
    tabs: state.tabs.map((t) => (t.id === id ? { ...t, content: savedBaseline(t) } : t)),
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
      dirty: isTabDirty(t),
    })),
    activeId: state.activeId,
  };
}
