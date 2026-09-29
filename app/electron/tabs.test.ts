import { describe, expect, it } from 'vitest';
import {
  BLANK_TAB_CONTENT,
  BLANK_TAB_TITLE,
  SETTINGS_TAB_TITLE,
  activateTab,
  closeTab,
  createBlankTab,
  createInitialState,
  getActiveTab,
  isBlankTab,
  nextTabId,
  openBlankTab,
  openFileTab,
  openSettingsTab,
  tabDisplayTitle,
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
  it('空白标签无路径且带占位正文', () => {
    const t = createBlankTab('x');
    expect(t).toEqual({ id: 'x', kind: 'doc', filePath: '', content: BLANK_TAB_CONTENT });
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
    expect(next.tabs[0]).toEqual({ id: 't0', kind: 'doc', filePath: '/docs/a.md', content: '# A' });
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

  it('同路径命中优先于空白标签占用', () => {
    const s: TabsState = {
      tabs: [
        { id: 'a', kind: 'doc', filePath: '/docs/a.md', content: '# A' },
        createBlankTab('blank'),
      ],
      activeId: 'blank',
    };
    const next = openFileTab(s, 'new', '/docs/a.md', '# A2');
    expect(next.tabs).toHaveLength(2);
    expect(next.activeId).toBe('a');
    expect(next.tabs.find((t) => t.id === 'blank')?.filePath).toBe('');
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
        { id: 'a', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' },
        { id: 'blank', kind: 'doc', title: BLANK_TAB_TITLE, filePath: '' },
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
    expect(getActiveTab(next)).toEqual({ id: 'set', kind: 'settings', filePath: '', content: '' });
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
