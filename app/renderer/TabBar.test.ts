import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from 'vue';
import TabBar from './TabBar.vue';
import type { TabSummary } from './electronBridge';

const TABS: TabSummary[] = [
  { id: 'a', title: 'a.md', filePath: '/docs/a.md' },
  { id: 'b', title: 'b.md', filePath: '/docs/b.md' },
  { id: 'blank', title: '新标签页', filePath: '' },
];

let mounted: { app: App; el: HTMLElement } | null = null;

function mount(props: Record<string, unknown>): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(TabBar, { tabs: TABS, activeId: 'b', ...props });
  app.mount(el);
  mounted = { app, el };
  return el;
}

function click(node: Element, init: MouseEventInit = {}): void {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
}

afterEach(() => {
  mounted?.app.unmount();
  mounted?.el.remove();
  mounted = null;
});

describe('TabBar 渲染', () => {
  it('每个标签渲染一格，标题取 title', () => {
    const el = mount({});
    const titles = [...el.querySelectorAll('.tab-title')].map((n) => n.textContent);
    expect(titles).toEqual(['a.md', 'b.md', '新标签页']);
  });

  it('只有活动标签带 active 类与 aria-selected', () => {
    const el = mount({ activeId: 'b' });
    const tabs = [...el.querySelectorAll('.tab')];
    expect(tabs.map((t) => t.classList.contains('active'))).toEqual([false, true, false]);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('activeId 变化后高亮跟着换', async () => {
    const el = mount({ activeId: 'b' });
    expect(el.querySelectorAll('.tab')[1]!.classList.contains('active')).toBe(true);
    mounted!.app.unmount();
    const el2 = mount({ activeId: 'a' });
    const tabs = [...el2.querySelectorAll('.tab')];
    expect(tabs[0]!.classList.contains('active')).toBe(true);
    expect(tabs[1]!.classList.contains('active')).toBe(false);
  });

  it('悬浮提示用完整路径，空白标签退回标题', () => {
    const el = mount({});
    const tabs = [...el.querySelectorAll('.tab')];
    expect(tabs[0]!.getAttribute('title')).toBe('/docs/a.md');
    expect(tabs[2]!.getAttribute('title')).toBe('新标签页');
  });

  it('标签为空时只剩加号按钮', () => {
    const el = mount({ tabs: [], activeId: '' });
    expect(el.querySelectorAll('.tab')).toHaveLength(0);
    expect(el.querySelector('.tab-new')).not.toBeNull();
  });
});

describe('TabBar 交互', () => {
  it('点标签体发 activate，带上该标签 id', () => {
    const onActivate = vi.fn();
    const el = mount({ onActivate });
    click(el.querySelectorAll('.tab')[2]!);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('blank');
  });

  it('点关闭按钮发 close，且不误发 activate', () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const el = mount({ onActivate, onClose });
    click(el.querySelectorAll('.tab-close')[0]!);
    expect(onClose).toHaveBeenCalledWith('a');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('中键点标签也关闭', () => {
    const onClose = vi.fn();
    const el = mount({ onClose });
    el.querySelectorAll('.tab')[1]!.dispatchEvent(
      new MouseEvent('auxclick', { bubbles: true, button: 1 })
    );
    expect(onClose).toHaveBeenCalledWith('b');
  });

  it('右键（button 2）的 auxclick 不关闭', () => {
    const onClose = vi.fn();
    const el = mount({ onClose });
    el.querySelectorAll('.tab')[1]!.dispatchEvent(
      new MouseEvent('auxclick', { bubbles: true, button: 2 })
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('点加号发 new，不带标签 id', () => {
    const onNew = vi.fn();
    const onActivate = vi.fn();
    const el = mount({ onNew, onActivate });
    click(el.querySelector('.tab-new')!);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
