import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLICK_BURST_MS,
  PLAIN_BURST_CLASSES,
  burstFromClick,
  burstFromPointer,
  burstKind,
  clearClickBursts,
  clickBursts,
  inkAmplitude,
  inkPush,
  makeStars,
  paintInkMap,
  placeRipple,
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
  it('水波圈不超过按钮较短的一边，点在边上也会收进按钮里', () => {
    const wide = placeRipple({ left: 0, top: 10, width: 80, height: 26 }, 2, 12);
    expect(wide.diameter).toBe(26);
    expect(wide.x - wide.diameter / 2).toBeGreaterThanOrEqual(0);
    expect(wide.x + wide.diameter / 2).toBeLessThanOrEqual(80);
    expect(wide.y - wide.diameter / 2).toBeGreaterThanOrEqual(10);
    expect(wide.y + wide.diameter / 2).toBeLessThanOrEqual(36);

    const square = placeRipple({ left: 100, top: 8, width: 28, height: 28 }, 120, 16);
    expect(square.diameter).toBe(28);
    expect(square.x).toBe(114);
    expect(square.y).toBe(22);
    expect(square.x - square.diameter / 2).toBe(100);
    expect(square.y + square.diameter / 2).toBe(36);
  });

  it('复制散开十颗，别的按钮七颗，都透，方向各不相同', () => {
    const rich = makeStars(true, () => 0.5);
    const plain = makeStars(false, () => 0.5);
    expect(rich).toHaveLength(10);
    expect(plain).toHaveLength(7);
    expect(rich.filter((star) => star.shape === 'star').length).toBeGreaterThan(0);
    expect(rich.filter((star) => star.shape === 'dot').length).toBeGreaterThan(1);

    const angles = rich.map((star) => Math.atan2(star.dy, star.dx).toFixed(3));
    expect(new Set(angles).size).toBe(rich.length);
    for (const star of rich) {
      const dist = Math.hypot(star.dx, star.dy);
      expect(dist).toBeGreaterThan(16);
      expect(dist).toBeLessThan(32);
      expect(star.size).toBeLessThan(9);
      expect(star.alpha).toBeGreaterThan(0.2);
      expect(star.alpha).toBeLessThan(0.5);
      expect(star.color.startsWith('#f') || star.color.startsWith('#c')).toBe(true);
      expect(star.spin).not.toBe(0);
    }
    for (const star of plain) {
      const dist = Math.hypot(star.dx, star.dy);
      expect(dist).toBeGreaterThan(12);
      expect(dist).toBeLessThan(26);
      expect(star.size).toBeLessThan(8);
      expect(star.alpha).toBeLessThan(rich[0]!.alpha);
    }
    expect(Math.hypot(rich[0]!.dx, rich[0]!.dy)).toBeGreaterThan(Math.hypot(plain[0]!.dx, plain[0]!.dy));
  });

  it('水波从点击处向外推，贴图让字跟着这一圈走', () => {
    expect(inkAmplitude(0)).toBe(0);
    expect(inkAmplitude(1)).toBe(0);
    expect(inkAmplitude(0.5)).toBeGreaterThan(inkAmplitude(0.2));
    expect(inkPush(0.08, 0, 0.1)).toBeGreaterThan(inkPush(0.9, 0, 0.1));
    expect(inkPush(0.95, 0, 0.85)).toBeGreaterThan(inkPush(0.05, 0, 0.85));

    const size = 41;
    const data = new Uint8ClampedArray(size * size * 4);
    paintInkMap(data, size, 0.5, 0.5, 0.25);
    let maxRed = -1;
    let minRed = 999;
    let maxX = 0;
    let minX = 0;
    const mid = (size - 1) / 2;
    for (let i = 0; i < size * size; i++) {
      const red = data[i * 4]!;
      if (red > maxRed) {
        maxRed = red;
        maxX = i % size;
      }
      if (red < minRed) {
        minRed = red;
        minX = i % size;
      }
    }
    expect(maxX).toBeGreaterThan(mid);
    expect(minX).toBeLessThan(mid);
    expect(maxRed).toBeGreaterThan(200);
    expect(minRed).toBeLessThan(60);

    const corner = data[0]!;
    expect(Math.abs(corner - 128)).toBeLessThan(30);
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

    copy.getBoundingClientRect = () => ({
      x: 30, y: 10, left: 30, top: 10, right: 58, bottom: 38, width: 28, height: 28, toJSON() { return {}; },
    });
    const burst = burstFromPointer(pointerOn(icon, 0, 40, 18));
    expect(burst?.rich).toBe(true);
    expect(burst?.x).toBe(40);
    expect(burst?.y).toBe(18);
    expect(burst?.rippleDiameter).toBe(28);
    expect(burst!.rippleX - burst!.rippleDiameter / 2).toBeGreaterThanOrEqual(burst!.clip.left);
    expect(burst!.rippleY - burst!.rippleDiameter / 2).toBeGreaterThanOrEqual(burst!.clip.top);
    expect(burst!.rippleX + burst!.rippleDiameter / 2).toBeLessThanOrEqual(burst!.clip.left + burst!.clip.width);
    expect(burst!.rippleY + burst!.rippleDiameter / 2).toBeLessThanOrEqual(burst!.clip.top + burst!.clip.height);
    expect(clickBursts.value).toHaveLength(1);
    expect(copy.classList.contains('is-ink-rippling')).toBe(true);

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
    expect(first?.rippleDiameter).toBe(20);
    expect(first!.rippleX - first!.rippleDiameter / 2).toBeGreaterThanOrEqual(10);
    expect(first!.rippleY + first!.rippleDiameter / 2).toBeLessThanOrEqual(40);

    vi.advanceTimersByTime(400);
    const second = spawnClickBurst(8, 9, false, copy);
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
    expect(spawnClickBurst(1, 2, true, copy)).toBeNull();
    expect(clickBursts.value).toHaveLength(0);
    expect(copy.classList.contains('is-ink-rippling')).toBe(false);
  });

  it('水波卸掉之后字上的滤镜也去掉', () => {
    const copy = button('tab-copy');
    copy.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 28, bottom: 28, width: 28, height: 28, toJSON() { return {}; },
    });
    spawnClickBurst(14, 14, true, copy);
    expect(copy.classList.contains('is-ink-rippling')).toBe(true);
    clearClickBursts();
    expect(copy.classList.contains('is-ink-rippling')).toBe(false);
    expect(copy.style.filter).toBe('');
    expect(document.querySelectorAll('.markly-ink-defs')).toHaveLength(0);
  });
});
