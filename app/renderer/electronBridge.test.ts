import { describe, expect, it } from 'vitest';
import { parseAppearance, parseTabsView } from './electronBridge';
import { DEFAULT_FONT_SIZE } from '../electron/appearance';

const GEORGIA = "Georgia, 'Times New Roman', serif";

describe('parseTabsView', () => {
  it('正常载荷原样收敛', () => {
    expect(
      parseTabsView({
        tabs: [{ id: 'a', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' }],
        activeId: 'a',
      })
    ).toEqual({
      tabs: [{ id: 'a', kind: 'doc', title: 'a.md', filePath: '/docs/a.md' }],
      activeId: 'a',
    });
  });

  it('非对象载荷 → 空标签条', () => {
    expect(parseTabsView(undefined)).toEqual({ tabs: [], activeId: '' });
    expect(parseTabsView(null)).toEqual({ tabs: [], activeId: '' });
    expect(parseTabsView('tabs')).toEqual({ tabs: [], activeId: '' });
  });

  it('tabs 不是数组 → 空列表但保留 activeId 类型检查', () => {
    expect(parseTabsView({ tabs: 'nope', activeId: 'a' })).toEqual({ tabs: [], activeId: 'a' });
  });

  it('丢掉无 id 的条目', () => {
    const view = parseTabsView({
      tabs: [
        { id: 'a', title: 'a.md', filePath: '/a.md' },
        { title: '无 id', filePath: '/b.md' },
        { id: 42, title: 'id 类型错', filePath: '/c.md' },
        null,
        'x',
      ],
      activeId: 'a',
    });
    expect(view.tabs.map((t) => t.id)).toEqual(['a']);
  });

  it('title 缺失或为空时退回默认标题', () => {
    const view = parseTabsView({
      tabs: [
        { id: 'a', filePath: '/a.md' },
        { id: 'b', title: '', filePath: '' },
        { id: 'c', title: 7, filePath: '/c.md' },
      ],
      activeId: '',
    });
    expect(view.tabs.map((t) => t.title)).toEqual(['新标签页', '新标签页', '新标签页']);
  });

  it('filePath 非字符串时归一为空串', () => {
    const view = parseTabsView({ tabs: [{ id: 'a', title: 'a.md', filePath: 9 }], activeId: 'a' });
    expect(view.tabs[0]!.filePath).toBe('');
  });

  it('activeId 非字符串时归一为空串', () => {
    expect(parseTabsView({ tabs: [], activeId: 5 }).activeId).toBe('');
  });

  it('settings 标签的 kind 被保留', () => {
    const view = parseTabsView({
      tabs: [{ id: 's', kind: 'settings', title: '设置', filePath: '' }],
      activeId: 's',
    });
    expect(view.tabs[0]!.kind).toBe('settings');
  });

  it('kind 缺失或非法时按文档标签处理', () => {
    const view = parseTabsView({
      tabs: [
        { id: 'a', title: 'a.md', filePath: '/a.md' },
        { id: 'b', kind: 'bogus', title: 'b.md', filePath: '/b.md' },
      ],
      activeId: 'a',
    });
    expect(view.tabs.map((t) => t.kind)).toEqual(['doc', 'doc']);
  });
});

describe('parseAppearance', () => {
  it('正常载荷逐项收敛', () => {
    expect(
      parseAppearance({ theme: 'nord', fontFamily: GEORGIA, fontSize: 20, prefersDark: true })
    ).toEqual({ theme: 'nord', fontFamily: GEORGIA, fontSize: 20, prefersDark: true });
  });

  it('非对象载荷给出安全默认', () => {
    expect(parseAppearance(undefined)).toEqual({
      theme: 'auto',
      fontFamily: '',
      fontSize: DEFAULT_FONT_SIZE,
      prefersDark: false,
    });
  });

  it('未知主题退回 auto', () => {
    expect(parseAppearance({ theme: 'hotdog-stand' }).theme).toBe('auto');
  });

  it('白名单外的字体退回系统默认', () => {
    expect(parseAppearance({ fontFamily: 'Comic Sans MS' }).fontFamily).toBe('');
  });

  it('越界字号被收敛，缺失时用默认', () => {
    expect(parseAppearance({ fontSize: 900 }).fontSize).toBe(28);
    expect(parseAppearance({ fontSize: '20' }).fontSize).toBe(DEFAULT_FONT_SIZE);
  });

  it('prefersDark 只认布尔真', () => {
    expect(parseAppearance({ prefersDark: 'yes' }).prefersDark).toBe(false);
    expect(parseAppearance({ prefersDark: true }).prefersDark).toBe(true);
  });
});
