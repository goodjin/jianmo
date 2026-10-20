import { describe, expect, it } from 'vitest';
import {
  BLANK_TAB_CONTENT,
  BLANK_TAB_TITLE,
  WELCOME_EMAIL,
  WELCOME_EMAIL_LABEL,
  WELCOME_REPO,
  WELCOME_REPO_LABEL,
  SETTINGS_TAB_TITLE,
  activateTab,
  closeTab,
  createBlankTab,
  createInitialState,
  getActiveTab,
  isBlankTab,
  adoptDiskContent,
  isTabDirty,
  markTabSaved,
  nextTabId,
  openBlankTab,
  openFileTab,
  openSettingsTab,
  tabDisplayTitle,
  closeTabsForPath,
  renameFileInTabs,
  revertTabContent,
  leastRecentlyViewedId,
  noteTabViewed,
  setActiveContent,
  summarizeTabs,
  tabTitle,
  type TabsState,
} from './tabs';

/** 三个已打开文件的状态，活动标签是中间那个。 */
function threeFiles(): TabsState {
  return {
    tabs: [
      { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
      { id: 'b', kind: 'doc', filePath: '/docs/b.md', content: '# B' },
      { id: 'c', kind: 'doc', filePath: '/docs/c.md', content: '# C' },
    ],
    activeId: 'b',
  };
}

describe('tabTitle', () => {
  it('取 POSIX 路径的文件名', () => {
    expect(tabTitle('/Users/me/docs/note.md')).toBe('note.md');
  });

  it('取 Windows 路径的文件名', () => {
    expect(tabTitle('C:\\docs\\note.md')).toBe('note.md');
  });

  it('空路径退回空白标签标题', () => {
    expect(tabTitle('')).toBe(BLANK_TAB_TITLE);
    expect(tabTitle('   ')).toBe(BLANK_TAB_TITLE);
  });
});

describe('nextTabId', () => {
  it('连续取号互不相同', () => {
    const ids = new Set([nextTabId(), nextTabId(), nextTabId()]);
    expect(ids.size).toBe(3);
  });
});

describe('createBlankTab / createInitialState / isBlankTab', () => {
  it('空白页记下仓库地址和邮箱', () => {
    expect(WELCOME_REPO).toBe('https://github.com/goodjin/jianmo');
    expect(WELCOME_EMAIL).toBe('goodjin2@gmail.com');
    expect(WELCOME_REPO_LABEL).toBe('仓库地址');
    expect(WELCOME_EMAIL_LABEL).toBe('联系邮箱');
    expect(BLANK_TAB_CONTENT).toContain(`${WELCOME_REPO_LABEL}：${WELCOME_REPO}`);
    expect(BLANK_TAB_CONTENT).toContain(`${WELCOME_EMAIL_LABEL}：${WELCOME_EMAIL}`);
  });

  it('空白标签无路径且带占位正文', () => {
    const t = createBlankTab('x');
    expect(t).toEqual({
      id: 'x',
      kind: 'doc',
      filePath: '',
      content: BLANK_TAB_CONTENT,
      savedContent: BLANK_TAB_CONTENT,
      diskMtimeMs: null,
    });
    expect(isBlankTab(t)).toBe(true);
  });

  it('初始状态只有一个空白标签且它是活动的', () => {
    const s = createInitialState('x');
    expect(s.tabs).toHaveLength(1);
    expect(s.activeId).toBe('x');
    expect(getActiveTab(s)?.filePath).toBe('');
  });

  it('带路径的标签不是空白标签', () => {
    expect(isBlankTab({ id: 'a', kind: 'doc', filePath: '/a.md', content: '' })).toBe(false);
    expect(isBlankTab(null)).toBe(false);
  });
});

describe('getActiveTab', () => {
  it('返回 activeId 指向的标签', () => {
    expect(getActiveTab(threeFiles())?.filePath).toBe('/docs/b.md');
  });

  it('activeId 悬空时返回 null', () => {
    expect(getActiveTab({ tabs: [], activeId: 'gone' })).toBeNull();
  });
});

describe('activateTab', () => {
  it('切到已存在的标签', () => {
    expect(activateTab(threeFiles(), 'c').activeId).toBe('c');
  });

  it('未知 id 不改变活动标签', () => {
    const s = threeFiles();
    expect(activateTab(s, 'zzz')).toBe(s);
    expect(activateTab(s, 'zzz').activeId).toBe('b');
  });

  it('重复激活当前标签时状态不变', () => {
    const s = threeFiles();
    expect(activateTab(s, 'b')).toBe(s);
  });
});

describe('openBlankTab', () => {
  it('追加空白标签并激活它', () => {
    const next = openBlankTab(threeFiles(), 'new');
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'b', 'c', 'new']);
    expect(next.activeId).toBe('new');
    expect(getActiveTab(next)?.content).toBe(BLANK_TAB_CONTENT);
  });

  it('id 与现有标签冲突时拒绝，不产生重复标签', () => {
    const s = threeFiles();
    expect(openBlankTab(s, 'a')).toBe(s);
  });

  it('空 id 被拒绝', () => {
    const s = threeFiles();
    expect(openBlankTab(s, '')).toBe(s);
  });

  it('可以连开多个空白标签', () => {
    const s = openBlankTab(openBlankTab(createInitialState('t0'), 't1'), 't2');
    expect(s.tabs).toHaveLength(3);
    expect(s.activeId).toBe('t2');
  });
});

describe('openFileTab', () => {
  it('空白标签被就地占用，不新增标签', () => {
    const next = openFileTab(createInitialState('t0'), 'new', '/docs/a.md', '# A');
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0]).toEqual({
      id: 't0',
      kind: 'doc',
      filePath: '/docs/a.md',
      content: '# A',
      savedContent: '# A',
      diskMtimeMs: null,
    });
    expect(next.activeId).toBe('t0');
  });

  it('活动标签已有文件时追加新标签并激活', () => {
    const next = openFileTab(threeFiles(), 'd', '/docs/d.md', '# D');
    expect(next.tabs.map((t) => t.filePath)).toEqual([
      '/docs/a.md',
      '/docs/b.md',
      '/docs/c.md',
      '/docs/d.md',
    ]);
    expect(next.activeId).toBe('d');
  });

  it('同路径已开则激活原标签并刷新正文，不重复开', () => {
    const next = openFileTab(threeFiles(), 'dup', '/docs/a.md', '# A 已改');
    expect(next.tabs).toHaveLength(3);
    expect(next.activeId).toBe('a');
    expect(next.tabs.find((t) => t.id === 'a')?.content).toBe('# A 已改');
    expect(next.tabs.find((t) => t.id === 'b')?.content).toBe('# B');
  });

  it('当前是空标签时，点一篇还没打开的文档会填进这张标签', () => {
    const s: TabsState = {
      tabs: [
        { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
        createBlankTab('blank'),
        createBlankTab('other'),
      ],
      activeId: 'blank',
    };
    const next = openFileTab(s, 'new', '/docs/d.md', '# D');
    expect(next.tabs).toHaveLength(3);
    expect(next.activeId).toBe('blank');
    expect(next.tabs.find((t) => t.id === 'blank')).toEqual({
      id: 'blank',
      kind: 'doc',
      filePath: '/docs/d.md',
      content: '# D',
      savedContent: '# D',
      diskMtimeMs: null,
    });
    expect(next.tabs.find((t) => t.id === 'other')?.filePath).toBe('');
    expect(next.tabs.find((t) => t.id === 'a')?.content).toBe('# A');
  });

  it('空标签下再点已经打开的文档，切到那个标签并关掉这张用不上的空标签', () => {
    const s: TabsState = {
      tabs: [
        { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
        createBlankTab('blank'),
        createBlankTab('other'),
      ],
      activeId: 'blank',
    };
    const next = openFileTab(s, 'new', '/docs/a.md', '# A2');
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'other']);
    expect(next.activeId).toBe('a');
    expect(next.tabs.find((t) => t.id === 'a')?.content).toBe('# A2');
    expect(next.tabs.find((t) => t.id === 'blank')).toBeUndefined();
    expect(next.tabs.find((t) => t.id === 'other')?.filePath).toBe('');
  });

  it('当前标签已有文档时，再点别的 md 会另开标签，不会填进旁边的空标签', () => {
    const s: TabsState = {
      tabs: [
        { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
        createBlankTab('blank'),
      ],
      activeId: 'a',
    };
    const opened = openFileTab(s, 'd', '/docs/d.md', '# D');
    expect(opened.tabs.map((t) => t.id)).toEqual(['a', 'blank', 'd']);
    expect(opened.activeId).toBe('d');
    expect(opened.tabs.find((t) => t.id === 'a')?.content).toBe('# A');
    expect(opened.tabs.find((t) => t.id === 'blank')?.filePath).toBe('');

    const again = openFileTab(opened, 'dup', '/docs/a.md', '# A2');
    expect(again.tabs.map((t) => t.id)).toEqual(['a', 'blank', 'd']);
    expect(again.activeId).toBe('a');
    expect(again.tabs.find((t) => t.id === 'blank')?.filePath).toBe('');
    expect(again.tabs.find((t) => t.id === 'a')?.content).toBe('# A2');
  });

  it('空路径不改变状态', () => {
    const s = threeFiles();
    expect(openFileTab(s, 'new', '', '# X')).toBe(s);
    expect(openFileTab(s, 'new', '   ', '# X')).toBe(s);
  });

  it('新标签 id 与现有标签冲突时拒绝', () => {
    const s = threeFiles();
    expect(openFileTab(s, 'a', '/docs/d.md', '# D')).toBe(s);
  });

  it('路径两端空白被裁掉后按同一文档处理', () => {
    const next = openFileTab(threeFiles(), 'dup', '  /docs/c.md  ', '# C2');
    expect(next.tabs).toHaveLength(3);
    expect(next.activeId).toBe('c');
  });
});

describe('closeTab', () => {
  it('关闭非活动标签时活动标签不变', () => {
    const next = closeTab(threeFiles(), 'a', 'blank');
    expect(next.tabs.map((t) => t.id)).toEqual(['b', 'c']);
    expect(next.activeId).toBe('b');
  });

  it('关闭活动标签时右邻接管', () => {
    const next = closeTab(threeFiles(), 'b', 'blank');
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(next.activeId).toBe('c');
  });

  it('关闭最右侧的活动标签时左邻接管', () => {
    const next = closeTab({ ...threeFiles(), activeId: 'c' }, 'c', 'blank');
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'b']);
    expect(next.activeId).toBe('b');
  });

  it('关掉最后一个标签会留下一个新的空白标签', () => {
    const one: TabsState = {
      tabs: [{ id: 'a', kind: 'doc', filePath: '/a.md', content: '# A' }],
      activeId: 'a',
    };
    const next = closeTab(one, 'a', 'blank');
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0]).toEqual({
      id: 'blank',
      kind: 'doc',
      filePath: '',
      content: BLANK_TAB_CONTENT,
      savedContent: BLANK_TAB_CONTENT,
      diskMtimeMs: null,
    });
    expect(next.activeId).toBe('blank');
  });

  it('未知 id 不改变状态', () => {
    const s = threeFiles();
    expect(closeTab(s, 'zzz', 'blank')).toBe(s);
  });
});

describe('setActiveContent', () => {
  it('只改活动标签的正文', () => {
    const next = setActiveContent(threeFiles(), '# B 改过了');
    expect(next.tabs.find((t) => t.id === 'b')?.content).toBe('# B 改过了');
    expect(next.tabs.find((t) => t.id === 'a')?.content).toBe('# A');
    expect(next.tabs.find((t) => t.id === 'c')?.content).toBe('# C');
  });

  it('没有活动标签时原样返回', () => {
    const s: TabsState = { tabs: [], activeId: 'gone' };
    expect(setActiveContent(s, 'x')).toBe(s);
  });

  it('第一次改字把改之前的正文冻成基线，改回去就不算未保存', () => {
    const once = setActiveContent(threeFiles(), '# B 改过了');
    const edited = getActiveTab(once);
    expect(edited?.savedContent).toBe('# B');
    expect(isTabDirty(edited)).toBe(true);
    const back = setActiveContent(once, '# B');
    expect(isTabDirty(getActiveTab(back))).toBe(false);
  });

  it('空白欢迎词没改过不算未保存', () => {
    expect(isTabDirty(getActiveTab(createInitialState('t0')))).toBe(false);
  });
});

describe('markTabSaved / revertTabContent', () => {
  it('保存后圆点消失，并记住路径和修改时间', () => {
    const dirty = setActiveContent(createInitialState('t0'), '新正文');
    expect(isTabDirty(getActiveTab(dirty))).toBe(true);
    const saved = markTabSaved(dirty, 't0', '/docs/new.md', 42);
    const tab = getActiveTab(saved);
    expect(tab?.filePath).toBe('/docs/new.md');
    expect(tab?.content).toBe('新正文');
    expect(tab?.savedContent).toBe('新正文');
    expect(tab?.diskMtimeMs).toBe(42);
    expect(isTabDirty(tab)).toBe(false);
    expect(summarizeTabs(saved).tabs[0]?.dirty).toBe(false);
  });

  it('放弃修改后正文回到上次保存的那一版', () => {
    const dirty = setActiveContent(threeFiles(), '# B 改过了');
    const back = revertTabContent(dirty, 'b');
    expect(getActiveTab(back)?.content).toBe('# B');
    expect(isTabDirty(getActiveTab(back))).toBe(false);
  });

  it('没有未保存的修改时放弃是原样返回', () => {
    const s = threeFiles();
    expect(revertTabContent(s, 'b')).toBe(s);
  });

  it('刷新换成磁盘正文后，基线跟着走，不再算未保存', () => {
    const dirty = setActiveContent(threeFiles(), '# B 改过了');
    const next = adoptDiskContent(dirty, 'b', '# B 磁盘\r\n', 7);
    const tab = next.tabs.find((t) => t.id === 'b');
    expect(tab?.content).toBe('# B 磁盘\r\n');
    expect(tab?.savedContent).toBe('# B 磁盘\r\n');
    expect(tab?.diskMtimeMs).toBe(7);
    expect(isTabDirty(tab)).toBe(false);
    expect(isTabDirty(next.tabs.find((t) => t.id === 'a'))).toBe(false);
  });

  it('从磁盘重新打开会把基线换成新正文', () => {
    const dirty = setActiveContent(threeFiles(), '# B 改过了');
    const next = openFileTab(dirty, 'dup', '/docs/b.md', '# B 磁盘', 99);
    const tab = next.tabs.find((t) => t.id === 'b');
    expect(tab?.content).toBe('# B 磁盘');
    expect(tab?.savedContent).toBe('# B 磁盘');
    expect(tab?.diskMtimeMs).toBe(99);
    expect(isTabDirty(tab)).toBe(false);
  });
});

describe('summarizeTabs', () => {
  it('输出标题与活动 id，且不带正文', () => {
    const view = summarizeTabs({
      tabs: [
        { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
        createBlankTab('blank'),
      ],
      activeId: 'blank',
    });
    expect(view).toEqual({
      tabs: [
        { id: 'a', kind: 'doc', title: 'a.md', filePath: '/docs/a.md', dirty: false },
        { id: 'blank', kind: 'doc', title: BLANK_TAB_TITLE, filePath: '', dirty: false },
      ],
      activeId: 'blank',
    });
    expect(JSON.stringify(view)).not.toContain('# A');
  });
});


describe('设置页标签', () => {
  it('新建时追加一个 settings 标签并激活', () => {
    const next = openSettingsTab(threeFiles(), 'set');
    expect(next.tabs).toHaveLength(4);
    expect(next.activeId).toBe('set');
    expect(getActiveTab(next)).toEqual({
      id: 'set',
      kind: 'settings',
      filePath: '',
      content: '',
      savedContent: '',
      diskMtimeMs: null,
    });
  });

  it('全局唯一：已存在时只激活，不再开第二个', () => {
    const once = openSettingsTab(threeFiles(), 'set');
    const twice = openSettingsTab(activateTab(once, 'a'), 'set2');
    expect(twice.tabs).toHaveLength(4);
    expect(twice.tabs.filter((t) => t.kind === 'settings')).toHaveLength(1);
    expect(twice.activeId).toBe('set');
  });

  it('id 与现有标签冲突时拒绝', () => {
    const s = threeFiles();
    expect(openSettingsTab(s, 'a')).toBe(s);
  });

  it('不是空白标签，打开文件不会顶掉它', () => {
    const withSettings = openSettingsTab(createInitialState('t0'), 'set');
    expect(isBlankTab(getActiveTab(withSettings))).toBe(false);
    const next = openFileTab(withSettings, 'doc1', '/docs/a.md', '# A');
    expect(next.tabs.map((t) => t.kind)).toEqual(['doc', 'settings', 'doc']);
    expect(next.tabs.find((t) => t.id === 'set')?.kind).toBe('settings');
    expect(next.activeId).toBe('doc1');
  });

  it('可以像普通标签一样关闭', () => {
    const withSettings = openSettingsTab(threeFiles(), 'set');
    const next = closeTab(withSettings, 'set', 'blank');
    expect(next.tabs.some((t) => t.kind === 'settings')).toBe(false);
    expect(next.activeId).toBe('c');
  });

  it('摘要里标题是"设置"并带上 kind', () => {
    const view = summarizeTabs(openSettingsTab(createInitialState('t0'), 'set'));
    expect(view.tabs[1]).toEqual({
      id: 'set',
      kind: 'settings',
      title: SETTINGS_TAB_TITLE,
      filePath: '',
      dirty: false,
    });
  });
});

describe('tabDisplayTitle', () => {
  it('文档标签取文件名', () => {
    expect(tabDisplayTitle({ id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '' })).toBe('a.md');
  });

  it('空白文档标签取默认名', () => {
    expect(tabDisplayTitle(createBlankTab('x'))).toBe(BLANK_TAB_TITLE);
  });

  it('设置标签固定叫设置', () => {
    expect(tabDisplayTitle({ id: 's', kind: 'settings', filePath: '', content: '' })).toBe(
      SETTINGS_TAB_TITLE
    );
  });
});

describe('closeTabsForPath', () => {
  it('关掉打开这个文件的标签，旁边的标签留着', () => {
    const next = closeTabsForPath(threeFiles(), '/docs/b.md', 'blank');
    expect(next.tabs.map((t) => t.filePath)).toEqual(['/docs/a.md', '/docs/c.md']);
    expect(next.tabs.map((t) => t.content)).toEqual(['# A', '# C']);
    expect(next.activeId).toBe('c');
  });

  it('关掉唯一的标签后留下一个空白标签', () => {
    const only = openFileTab(createInitialState('blank-0'), 'doc', '/docs/a.md', '# A');
    const next = closeTabsForPath(only, '/docs/a.md', 'blank-1');
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0]?.filePath).toBe('');
    expect(next.tabs[0]?.id).toBe('blank-1');
    expect(next.activeId).toBe('blank-1');
  });

  it('没打开这个文件时保持原状态', () => {
    const s = threeFiles();
    expect(closeTabsForPath(s, '/docs/missing.md', 'blank')).toBe(s);
    expect(closeTabsForPath(s, '  ', 'blank')).toBe(s);
  });
});

describe('renameFileInTabs', () => {
  it('已打开的文件改名后，标签路径换成新的，正文和活动标签不动', () => {
    const next = renameFileInTabs(threeFiles(), '/docs/b.md', '/docs/renamed.md');
    expect(next.tabs.map((t) => t.filePath)).toEqual(['/docs/a.md', '/docs/renamed.md', '/docs/c.md']);
    expect(next.tabs[1]?.content).toBe('# B');
    expect(next.activeId).toBe('b');
    expect(summarizeTabs(next).tabs[1]?.title).toBe('renamed.md');
  });

  it('没有打开这个文件、或新旧路径相同，就保持原状态', () => {
    const s = threeFiles();
    expect(renameFileInTabs(s, '/docs/missing.md', '/docs/x.md')).toBe(s);
    expect(renameFileInTabs(s, '/docs/b.md', '/docs/b.md')).toBe(s);
    expect(renameFileInTabs(s, '  ', '/docs/x.md')).toBe(s);
  });
});

describe('最久没有查看', () => {
  it('记下查看时间，正在看的那张不算候选', () => {
    const seen = noteTabViewed(noteTabViewed(threeFiles(), 'a', 10), 'c', 30);
    expect(seen.tabs.find((t) => t.id === 'a')?.lastViewedAt).toBe(10);
    expect(seen.tabs.find((t) => t.id === 'b')?.lastViewedAt).toBeUndefined();
    expect(leastRecentlyViewedId({ ...seen, activeId: 'c' })).toBe('b');
  });

  it('时间一样时选更靠左的', () => {
    const seen = noteTabViewed(noteTabViewed(threeFiles(), 'a', 5), 'c', 5);
    expect(leastRecentlyViewedId({ ...seen, activeId: 'b' })).toBe('a');
  });

  it('只剩正在看的一张时不再关', () => {
    expect(leastRecentlyViewedId(createInitialState('only'))).toBeNull();
  });

  it('未知标签不改状态', () => {
    const s = threeFiles();
    expect(noteTabViewed(s, 'missing', 9)).toBe(s);
    expect(noteTabViewed(s, '', 9)).toBe(s);
  });
});
