import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLICK_BURST_MS,
  PLAIN_BURST_CLASSES,
  burstFromClick,
  burstFromPointer,
  burstKind,
  clearClickBursts,
  clickBursts,
  INK_WAVE_WIDTH,
  inkAmplitude,
  inkShift,
  inkWave,
  paintInkMap,
  placeRipple,
  rippleEase,
  RIPPLE_EDGE_PAD,
  RIPPLE_MS,
  RIPPLE_WAVES,
  ringRadius,
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

describe('点击水波', () => {
  it('水波以按钮中心为圆心，直径用较短的一边，点在边上也不带偏', () => {
    const wide = placeRipple({ left: 0, top: 10, width: 80, height: 26 }, 2, 12);
    expect(wide.diameter).toBe(26);
    expect(wide.x).toBe(40);
    expect(wide.y).toBe(23);
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

  it('两圈都是正圆，先快后慢，外圈贴着按钮较短的一边', () => {
    expect(RIPPLE_WAVES).toHaveLength(2);
    const portions = RIPPLE_WAVES.map((wave) => wave.portion);
    const delays = RIPPLE_WAVES.map((wave) => wave.delay);
    expect(portions[0]).toBe(1);
    expect(portions.every((portion) => portion <= 1)).toBe(true);
    for (let i = 1; i < portions.length; i++) {
      expect(portions[i]!).toBeLessThan(portions[i - 1]!);
      expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    }

    const outer = ringRadius(28, 1);
    expect(outer).toBe(14 - RIPPLE_EDGE_PAD);
    expect(outer + RIPPLE_EDGE_PAD).toBe(14);
    const radii = RIPPLE_WAVES.map((wave) => ringRadius(28, wave.portion));
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeLessThan(radii[i - 1]!);
    }
    expect(ringRadius(2, 1)).toBe(0.6);
  });

  it('水波比慢动作短，开头快、临到边上慢，最后一圈走完才消失', () => {
    expect(RIPPLE_MS).toBeGreaterThan(600);
    expect(RIPPLE_MS).toBeLessThan(1200);
    const lastDelay = RIPPLE_WAVES[RIPPLE_WAVES.length - 1]!.delay;
    expect(lastDelay).toBeGreaterThan(0);
    expect(lastDelay).toBeLessThan(400);
    expect(CLICK_BURST_MS).toBe(lastDelay + RIPPLE_MS);
    expect(rippleEase(0)).toBe(0);
    expect(rippleEase(1)).toBe(1);
    const early = rippleEase(0.2);
    const late = 1 - rippleEase(0.8);
    expect(early).toBeGreaterThan(0.45);
    expect(late).toBeLessThan(0.12);
    expect(early).toBeGreaterThan(late);
  });

  it('水纹有波峰和波谷，从按钮中心向外走', () => {
    expect(inkAmplitude(0)).toBe(0);
    expect(inkAmplitude(1)).toBe(0);
    expect(inkAmplitude(0.5)).toBeCloseTo(1);

    const phase = 0.5;
    const ring = 0.12 + phase * 0.98;
    const half = INK_WAVE_WIDTH / 2;
    expect(inkWave(ring + half, phase)).toBeGreaterThan(0.7);
    expect(inkWave(ring - half, phase)).toBeLessThan(-0.7);
    expect(Math.abs(inkWave(4.5, phase))).toBeLessThan(0.05);

    const later = 0.72;
    const laterRing = 0.12 + later * 0.98;
    expect(laterRing).toBeGreaterThan(half);
    const crest = inkShift(0.5 + ((laterRing + half) * 50) / 100, 0.5, later, 100, 100);
    const trough = inkShift(0.5 + ((laterRing - half) * 50) / 100, 0.5, later, 100, 100);
    expect(crest.x).toBeGreaterThan(0.6);
    expect(trough.x).toBeLessThan(-0.6);
    expect(inkShift(0.5, 0.5, phase, 100, 100)).toEqual({ x: 0, y: 0 });

    const size = 81;
    const data = new Uint8ClampedArray(size * size * 4);
    paintInkMap(data, size, 0, 100, 100);
    expect(data[0]).toBe(128);
    expect(data[(40 * size + 40) * 4]).toBe(128);

    paintInkMap(data, size, phase, 100, 100);
    const mid = 40;
    let maxRed = -1;
    let minRed = 999;
    let maxX = 0;
    let minX = 0;
    for (let x = mid; x < size; x++) {
      const red = data[(mid * size + x) * 4]!;
      if (red > maxRed) {
        maxRed = red;
        maxX = x;
      }
      if (red < minRed) {
        minRed = red;
        minX = x;
      }
    }
    expect(maxRed).toBeGreaterThan(180);
    expect(minRed).toBeLessThan(80);
    expect(maxX).toBeGreaterThan(minX);
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
      x: 0, y: 10, left: 0, top: 10, right: 80, bottom: 36, width: 80, height: 26, toJSON() { return {}; },
    });
    const burst = burstFromPointer(pointerOn(icon, 0, 8, 14));
    expect(burst?.rich).toBe(true);
    expect(burst?.x).toBe(8);
    expect(burst?.y).toBe(14);
    expect(burst?.rippleX).toBe(40);
    expect(burst?.rippleY).toBe(23);
    expect(burst?.rippleDiameter).toBe(26);
    expect(burst!.rippleX - burst!.rippleDiameter / 2).toBeGreaterThanOrEqual(burst!.clip.left);
    expect(burst!.rippleY - burst!.rippleDiameter / 2).toBeGreaterThanOrEqual(burst!.clip.top);
    expect(burst!.rippleX + burst!.rippleDiameter / 2).toBeLessThanOrEqual(burst!.clip.left + burst!.clip.width);
    expect(burst!.rippleY + burst!.rippleDiameter / 2).toBeLessThanOrEqual(burst!.clip.top + burst!.clip.height);
    expect(clickBursts.value).toHaveLength(1);
    expect(copy.style.filter).toBe('');

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
    expect(copy.style.filter).toBe('');
  });

  it('画布不可用时不给按钮加滤镜，卸掉时也不留定义', () => {
    const copy = button('tab-copy');
    copy.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 28, bottom: 28, width: 28, height: 28, toJSON() { return {}; },
    });
    spawnClickBurst(14, 14, true, copy);
    expect(copy.style.filter).toBe('');
    clearClickBursts();
    expect(copy.style.filter).toBe('');
    expect(document.querySelectorAll('.markly-ink-defs')).toHaveLength(0);
  });
});
