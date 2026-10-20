import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLICK_BURST_MS,
  PLAIN_BURST_CLASSES,
  burstFromClick,
  burstFromPointer,
  burstKind,
  clearClickBursts,
  clickBursts,
  makeStars,
  spawnClickBurst,
} from './clickBurst';

function button(className: string, disabled = false): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = className;
  el.disabled = disabled;
  document.body.appendChild(el);
  return el;
}

/** 这个测试环境没有 PointerEvent。pointerdown 用带坐标的鼠标事件即可。 */
function pointerOn(el: Element, buttonId = 0, x = 40, y = 18): PointerEvent {
  let seen: MouseEvent | null = null;
  const handler = (event: Event) => {
    seen = event as MouseEvent;
  };
  el.addEventListener('pointerdown', handler);
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: buttonId }));
  el.removeEventListener('pointerdown', handler);
  if (!seen) throw new Error('pointerdown 没有送到');
  return seen as PointerEvent;
}

function clickOn(el: Element, detail: number): MouseEvent {
  let seen: MouseEvent | null = null;
  const handler = (event: Event) => {
    seen = event as MouseEvent;
  };
  el.addEventListener('click', handler);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
  el.removeEventListener('click', handler);
  if (!seen) throw new Error('click 没有送到');
  return seen;
}

afterEach(() => {
  clearClickBursts();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('点击水波和小星星', () => {
  it('复制散开八颗，别的按钮五颗，方向各不相同', () => {
    const rich = makeStars(true, () => 0.5);
    const plain = makeStars(false, () => 0.5);
    expect(rich).toHaveLength(8);
    expect(plain).toHaveLength(5);
    expect(rich.filter((star) => star.shape === 'star').length).toBeGreaterThan(0);
    expect(rich.filter((star) => star.shape === 'dot').length).toBeGreaterThan(0);

    const angles = rich.map((star) => Math.atan2(star.dy, star.dx).toFixed(3));
    expect(new Set(angles).size).toBe(rich.length);
    for (const star of rich) {
      const dist = Math.hypot(star.dx, star.dy);
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(50);
      expect(star.spin).not.toBe(0);
    }
    for (const star of plain) {
      const dist = Math.hypot(star.dx, star.dy);
      expect(dist).toBeGreaterThan(12);
      expect(dist).toBeLessThan(32);
    }
    expect(Math.hypot(rich[0]!.dx, rich[0]!.dy)).toBeGreaterThan(Math.hypot(plain[0]!.dx, plain[0]!.dy));
  });

  it('复制是热闹的一档，壳层按钮是轻的一档，文件行和禁用按钮不播', () => {
    const copy = button('chrome-btn tab-copy');
    expect(burstKind(copy)).toBe('rich');

    for (const name of PLAIN_BURST_CLASSES) {
      const el = button(name);
      expect(burstKind(el)).toBe('plain');
    }

    expect(burstKind(button('tree-row'))).toBeNull();
    expect(burstKind(button('recent-main'))).toBeNull();
    expect(burstKind(button('sibling-btn'))).toBeNull();
    expect(burstKind(button('tree-menu-danger'))).toBeNull();
    expect(burstKind(button('chrome-btn', true))).toBeNull();
    expect(burstKind(button('tab-copy', true))).toBeNull();
  });

  it('按下时从指尖冒出来，右键、点在按钮外、鼠标松开都不重复播', () => {
    const copy = button('tab-copy');
    const icon = document.createElement('svg');
    copy.appendChild(icon);

    const burst = burstFromPointer(pointerOn(icon, 0, 40, 18));
    expect(burst?.rich).toBe(true);
    expect(burst?.x).toBe(40);
    expect(burst?.y).toBe(18);
    expect(clickBursts.value).toHaveLength(1);

    expect(burstFromPointer(pointerOn(copy, 2, 1, 1))).toBeNull();
    expect(burstFromPointer(pointerOn(document.body, 0, 3, 4))).toBeNull();
    expect(burstFromClick(clickOn(copy, 1))).toBeNull();
    expect(clickBursts.value).toHaveLength(1);
  });

  it('键盘确认从按钮中心播，播完自己消失，后一颗不会被前一颗带走', () => {
    vi.useFakeTimers();
    const copy = button('tab-copy');
    copy.getBoundingClientRect = () => ({
      x: 10, y: 20, left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20, toJSON() { return {}; },
    });
    const first = burstFromClick(clickOn(copy, 0));
    expect(first?.x).toBe(20);
    expect(first?.y).toBe(30);
    expect(first?.rich).toBe(true);

    vi.advanceTimersByTime(400);
    const second = spawnClickBurst(8, 9, false);
    expect(second?.rich).toBe(false);
    expect(clickBursts.value.map((item) => item.id)).toEqual([first!.id, second!.id]);

    vi.advanceTimersByTime(CLICK_BURST_MS - 400);
    expect(clickBursts.value.map((item) => item.id)).toEqual([second!.id]);

    vi.advanceTimersByTime(400);
    expect(clickBursts.value).toHaveLength(0);
  });

  it('系统要求减少动效时不冒', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
    const copy = button('tab-copy');
    expect(burstFromPointer(pointerOn(copy, 0, 5, 6))).toBeNull();
    expect(spawnClickBurst(1, 2, true)).toBeNull();
    expect(clickBursts.value).toHaveLength(0);
  });
});
