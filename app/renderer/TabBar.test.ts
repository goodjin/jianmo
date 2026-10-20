import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
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
  it('未保存的标签多一个圆点', () => {
    const el = mount({
      tabs: [
        { id: 'a', title: 'a.md', filePath: '/docs/a.md', dirty: true },
        { id: 'b', title: 'b.md', filePath: '/docs/b.md', dirty: false },
      ],
      activeId: 'a',
    });
    const tabs = [...el.querySelectorAll('.tab')];
    expect(tabs[0]!.querySelector('.tab-dirty')).not.toBeNull();
    expect(tabs[1]!.querySelector('.tab-dirty')).toBeNull();
  });

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

  it('加号跟在最后一个标签后面，不挤到工具区', () => {
    const el = mount({});
    const strip = el.querySelector('.tab-strip')!;
    const titles = [...strip.querySelectorAll('.tab')];
    const plus = strip.querySelector('.tab-new');
    expect(plus).not.toBeNull();
    expect(titles[titles.length - 1]!.nextElementSibling).toBe(plus);
    expect(el.querySelector('.tab-tools')).not.toBeNull();
    expect(el.querySelector('.tab-tools .tab-new')).toBeNull();
    expect((strip as HTMLElement).getAttribute('style') ?? '').toContain('--tab-min: 120px');
  });

  it('标签条比窗口宽时才出现左右移动', async () => {
    const el = mount({});
    const strip = el.querySelector('.tab-strip') as HTMLElement;
    for (const key of ['clientWidth', 'scrollWidth', 'scrollLeft'] as const) {
      const desc = Object.getOwnPropertyDescriptor(strip, key) ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(strip), key);
      if (desc && desc.configurable === false) continue;
    }
    Object.defineProperty(strip, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, get: () => 800 });
    let left = 0;
    Object.defineProperty(strip, 'scrollLeft', {
      configurable: true,
      get: () => left,
      set: (value: number) => {
        left = value;
      },
    });
    strip.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(strip.clientWidth).toBe(200);
    expect(strip.scrollWidth).toBe(800);
    expect(el.querySelector('.tab-scroll-left')).toBeNull();
    expect(el.querySelector('.tab-scroll-right')).not.toBeNull();

    strip.scrollLeft = 120;
    strip.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(el.querySelector('.tab-scroll-left')).not.toBeNull();
    expect(el.querySelector('.tab-scroll-right')).not.toBeNull();
  });
});
