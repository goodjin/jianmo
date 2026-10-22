/**
 * 桌面壳层按钮被点下时，从按钮中心荡开两圈水波。
 * 圈先快后慢，外圈贴着按钮较短的一边。
 * 看得见的是一道水脊：外缘暗，往里是水色，脊上一条窄亮，内侧再暗一点。
 * 同一圈波会把按钮上的字轻轻推一下，再拉回来。
 * 画在 body 上，按按钮圆角裁住。文件列表和右键菜单不跟。
 * 系统开了「减少动效」就不播。
 */

import { ref } from 'vue';

/** 一圈从中心走到按钮边的时间。开头快，结尾慢。速度是 0.72 秒那一版的一半。 */
export const RIPPLE_MS = 1440;

/**
 * 跟圆的 CSS 缓动同一条。前半段已经走出大半，后半段才慢慢贴到边上。
 * 水波推字也用这条，字才和看得见的圈一起走。
 */
export const RIPPLE_EASE = { x1: 0.22, y1: 0.68, x2: 0.2, y2: 1 } as const;

/** 两圈。后面的更小、稍晚，直径都不超过按钮较短的一边。 */
export const RIPPLE_WAVES = [
  { portion: 1, delay: 0 },
  { portion: 0.62, delay: 260 },
] as const;

/** 最后一圈走完才卸掉。 */
export const CLICK_BURST_MS = RIPPLE_WAVES[RIPPLE_WAVES.length - 1].delay + RIPPLE_MS;

/** 波峰把字推开的像素。再大笔画会裂成两层，再小看不出在晃。 */
export const INK_CREST_PX = 4;

/** 波有多宽，按按钮较短一边的半径来量。太窄的话，相邻像素被拉开，字会裂开。 */
export const INK_WAVE_WIDTH = 1.35;

/** 描边画在半径两侧。半径收进这一截，整条细线才落在按钮里面。 */
export const RIPPLE_EDGE_PAD = 1.4;

/** 正圆半径。portion 为 1 时贴着按钮较短的一边，再让出描边。 */
export function ringRadius(diameter: number, portion: number): number {
  const raw = (diameter / 2) * portion - RIPPLE_EDGE_PAD;
  return Math.max(0.6, Math.round(raw * 100) / 100);
}

/** 这些是壳层上的操作按钮。文件行、最近打开里的文件名不算。 */
export const PLAIN_BURST_CLASSES = [
  'chrome-btn',
  'file-icon-btn',
  'file-toggle',
  'tab-new',
  'tab-close',
  'doc-outline-toggle',
  'action-item',
  'theme-card',
  'font-picker-button',
  'font-option',
  'recent-clear',
  'recent-icon',
  'recent-more',
] as const;

export type ButtonBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RippleClip = ButtonBox & {
  radius: string;
};

export type BurstSpec = {
  id: number;
  x: number;
  y: number;
  rich: boolean;
  rippleX: number;
  rippleY: number;
  rippleDiameter: number;
  clip: RippleClip;
  /** 第一帧画出来的时刻。半径和透明度都从这里算。 */
  bornAt?: number;
};

export type BurstKind = 'rich' | 'plain';

export const clickBursts = ref<BurstSpec[]>([]);

const timers = new Set<number>();
const inkJobs = new Map<HTMLButtonElement, { stop: () => void }>();
let nextId = 1;
let inkSeq = 1;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

/**
 * 水波是正圆，圆心用按钮中心，直径用较短的一边。
 * 点在边上也不会把圆心带过去。
 */
export function placeRipple(box: ButtonBox, _x = 0, _y = 0): { x: number; y: number; diameter: number } {
  const diameter = Math.max(0, Math.min(box.width, box.height));
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    diameter,
  };
}

/** 整段里波有多强。开头和结尾是 0，字不会停在歪的位置。 */
export function inkAmplitude(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0;
  return Math.sin(Math.PI * phase);
}

function unitBezier(u: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return ((a * u + b) * u + c) * u;
}

function unitBezierSlope(u: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return (3 * a * u + 2 * b) * u + c;
}

/** 时间 0 到 1，换成水波走出的比例。开头走得快，临到边上慢下来。 */
export function rippleEase(time: number): number {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  let u = time;
  for (let i = 0; i < 8; i++) {
    const slope = unitBezierSlope(u, RIPPLE_EASE.x1, RIPPLE_EASE.x2);
    if (Math.abs(slope) < 1e-6) break;
    u = clamp(u - (unitBezier(u, RIPPLE_EASE.x1, RIPPLE_EASE.x2) - time) / slope, 0, 1);
  }
  return unitBezier(u, RIPPLE_EASE.y1, RIPPLE_EASE.y2);
}

/** 整圈最多三成看得见。再实会盖住字。 */
export const RIDGE_VISIBLE = 0.3;

/**
 * 透明度按匀速走。跟半径共用先快后慢的话，圈还没到边上就淡没了。
 * 刚离开中心时先别露出来，免得描边比半径还宽，糊成一块。
 * 最高只有三成，不要再涂到九成。
 */
export function rippleFade(linear: number): number {
  if (linear <= 0.14 || linear >= 1) return 0;
  const late = RIDGE_VISIBLE * 0.73;
  if (linear < 0.24) return (RIDGE_VISIBLE * (linear - 0.14)) / 0.1;
  if (linear < 0.7) return RIDGE_VISIBLE + ((late - RIDGE_VISIBLE) * (linear - 0.24)) / 0.46;
  return (late * (1 - linear)) / 0.3;
}

/** 水脊有多宽。圈还小的时候收窄，避免把按钮中间涂实。 */
export function ridgeWidth(radius: number): number {
  return Math.min(5.4, Math.max(1.6, radius * 0.55));
}

export type RidgeInk = { r: number; g: number; b: number; a: number };

function overInk(dst: RidgeInk, r: number, g: number, b: number, a: number): void {
  const outA = a + dst.a * (1 - a);
  if (outA <= 0.0001) {
    dst.a = 0;
    return;
  }
  dst.r = (r * a + dst.r * dst.a * (1 - a)) / outA;
  dst.g = (g * a + dst.g * dst.a * (1 - a)) / outA;
  dst.b = (b * a + dst.b * dst.a * (1 - a)) / outA;
  dst.a = outA;
}

/**
 * t 从 0（外缘）到 1（内缘）。
 * 外缘是暗的，脊上偏外一条窄亮，内侧再暗下去。两端都淡掉。
 */
export function ridgeInk(t: number): RidgeInk {
  const clamped = clamp(t, 0, 1);
  const win = Math.sin(Math.PI * clamped);
  const crest = Math.exp(-((clamped - 0.42) ** 2) / (2 * 0.045 ** 2));
  const body = Math.exp(-((clamped - 0.58) ** 2) / (2 * 0.22 ** 2));
  const shadow = Math.exp(-((clamped - 0.18) ** 2) / (2 * 0.11 ** 2));
  const trough = Math.exp(-((clamped - 0.84) ** 2) / (2 * 0.1 ** 2));
  const dst: RidgeInk = { r: 0, g: 0, b: 0, a: 0 };
  overInk(dst, 14, 52, 92, shadow * win * 0.72);
  overInk(dst, 10, 36, 70, trough * win * 0.55);
  overInk(dst, 126, 198, 222, body * win * 0.62);
  overInk(dst, 255, 255, 255, crest * Math.pow(win, 0.65) * 0.92);
  return dst;
}

let ridgeInkPeak = 0;

function inkPeak(): number {
  if (ridgeInkPeak > 0) return ridgeInkPeak;
  for (let i = 0; i <= 64; i++) ridgeInkPeak = Math.max(ridgeInkPeak, ridgeInk(i / 64).a);
  return ridgeInkPeak || 1;
}

function overPixel(
  dst: RidgeInk,
  src: RidgeInk,
  srcA: number,
): void {
  const outA = srcA + dst.a * (1 - srcA);
  if (outA <= 0.0001) {
    dst.a = 0;
    return;
  }
  dst.r = (src.r * srcA + dst.r * dst.a * (1 - srcA)) / outA;
  dst.g = (src.g * srcA + dst.g * dst.a * (1 - srcA)) / outA;
  dst.b = (src.b * srcA + dst.b * dst.a * (1 - srcA)) / outA;
  dst.a = outA;
}

/**
 * 把两圈水脊画进正圆里。每个像素只取样一次，透明度封在三成。
 * bitmap 是画布像素，cssDiameter 是按钮上的尺寸，放大后水脊不会变细。
 */
export function paintRidgeImage(
  data: Uint8ClampedArray,
  bitmap: number,
  elapsedMs: number,
  cssDiameter = bitmap,
): void {
  if (bitmap < 1 || data.length < bitmap * bitmap * 4) return;
  data.fill(0);
  if (bitmap < 2 || cssDiameter < 2) return;
  const scale = bitmap / cssDiameter;
  const cx = (bitmap - 1) / 2;
  const cy = cx;
  const peak = inkPeak();
  const waves: Array<{ radius: number; width: number; fade: number }> = [];
  for (const wave of RIPPLE_WAVES) {
    const linear = (elapsedMs - wave.delay) / RIPPLE_MS;
    if (linear <= 0 || linear >= 1) continue;
    const fade = rippleFade(linear);
    if (fade <= 0.01) continue;
    const target = ringRadius(cssDiameter, wave.portion);
    const radius = 0.6 + (target - 0.6) * rippleEase(linear);
    waves.push({ radius, width: ridgeWidth(radius), fade });
  }
  if (waves.length === 0) return;
  for (let y = 0; y < bitmap; y++) {
    for (let x = 0; x < bitmap; x++) {
      const dist = Math.hypot(x - cx, y - cy) / scale;
      const dst: RidgeInk = { r: 0, g: 0, b: 0, a: 0 };
      for (const wave of waves) {
        const t = (wave.radius + wave.width / 2 - dist) / wave.width;
        if (t <= 0 || t >= 1) continue;
        const ink = ridgeInk(t);
        const srcA = (ink.a / peak) * wave.fade;
        if (srcA <= 0.001) continue;
        overPixel(dst, ink, srcA);
      }
      if (dst.a <= 0) continue;
      const i = (y * bitmap + x) * 4;
      data[i] = Math.round(dst.r);
      data[i + 1] = Math.round(dst.g);
      data[i + 2] = Math.round(dst.b);
      data[i + 3] = Math.round(Math.min(dst.a, RIDGE_VISIBLE) * 255);
    }
  }
}

/**
 * 距离按按钮较短一边的半径来量，1 是按钮边。
 * 正数把这一点往外推，负数往里拉。波峰在环的外侧，波谷在内侧。
 */
export function inkWave(dist: number, phase: number): number {
  const ring = 0.12 + clamp(phase, 0, 1) * 0.98;
  const delta = dist - ring;
  const width = INK_WAVE_WIDTH;
  const envelope = Math.exp(-(delta * delta) / (2 * width * width));
  return envelope * Math.sin((delta / width) * Math.PI);
}

/**
 * bx、by 是按钮自己的坐标，0 到 1。
 * 返回这一刻该点被推开的比例，大约 -1 到 1。
 */
export function inkShift(
  bx: number,
  by: number,
  phase: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const dx = (bx - 0.5) * width;
  const dy = (by - 0.5) * height;
  const distPx = Math.hypot(dx, dy);
  if (distPx < 0.5 || width < 2 || height < 2) return { x: 0, y: 0 };
  const radius = Math.min(width, height) / 2;
  const push = inkWave(distPx / radius, phase) * inkAmplitude(phase);
  return { x: (dx / distPx) * push, y: (dy / distPx) * push };
}

/** 滤镜区域比按钮大一圈，贴图要按同一块铺，圆心才在按钮中心。 */
const FILTER_X = -0.25;
const FILTER_Y = -0.4;
const FILTER_W = 1.5;
const FILTER_H = 1.8;
const INK_MAP_SIZE = 128;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** 红是左右，绿是上下，128 表示不动。 */
export function paintInkMap(
  data: Uint8ClampedArray,
  size: number,
  phase: number,
  width: number,
  height: number,
): void {
  if (size < 2 || data.length < size * size * 4) return;
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const by = FILTER_Y + v * FILTER_H;
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const bx = FILTER_X + u * FILTER_W;
      const shift = inkShift(bx, by, phase, width, height);
      const i = (y * size + x) * 4;
      data[i] = clampByte(128 + shift.x * 127);
      data[i + 1] = clampByte(128 + shift.y * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
}

function clipOf(button: HTMLButtonElement): RippleClip {
  const rect = button.getBoundingClientRect();
  let radius = '0px';
  if (typeof getComputedStyle === 'function') {
    const read = getComputedStyle(button).borderRadius;
    if (read) radius = read;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    radius,
  };
}

export function burstKind(button: HTMLButtonElement): BurstKind | null {
  if (button.disabled) return null;
  if (button.classList.contains('tab-copy')) return 'rich';
  if (PLAIN_BURST_CLASSES.some((name) => button.classList.contains(name))) return 'plain';
  return null;
}

function buttonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const found = target.closest('button');
  return found instanceof HTMLButtonElement ? found : null;
}

export function clearClickBursts(): void {
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
  const jobs = [...inkJobs.values()];
  inkJobs.clear();
  for (const job of jobs) job.stop();
  clickBursts.value = [];
}

/**
 * 在按钮自己身上贴一层水波，字会被波峰往外推、波谷拉回来。
 * 圆心是按钮中心。画布不可用时不加滤镜。播完一定卸掉。
 */
export function beginInkRipple(button: HTMLButtonElement): void {
  if (prefersReducedMotion() || !button.isConnected) return;
  const previous = inkJobs.get(button);
  if (previous) previous.stop();

  const rect = button.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;

  const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const canvas = document.createElement('canvas');
  canvas.width = INK_MAP_SIZE;
  canvas.height = INK_MAP_SIZE;
  let ctx: CanvasRenderingContext2D | null = null;
  if (!jsdom) {
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return;

  let image: ImageData;
  try {
    image = ctx.createImageData(INK_MAP_SIZE, INK_MAP_SIZE);
  } catch {
    return;
  }

  const id = `markly-ink-${inkSeq++}`;
  const previousFilter = button.style.filter;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'markly-ink-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.pointerEvents = 'none';
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '-25%');
  filter.setAttribute('y', '-40%');
  filter.setAttribute('width', '150%');
  filter.setAttribute('height', '180%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const feImage = document.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('result', 'map');
  feImage.setAttribute('preserveAspectRatio', 'none');
  feImage.setAttribute('x', '0');
  feImage.setAttribute('y', '0');
  feImage.setAttribute('width', '100%');
  feImage.setAttribute('height', '100%');
  const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
  feDisp.setAttribute('in', 'SourceGraphic');
  feDisp.setAttribute('in2', 'map');
  feDisp.setAttribute('xChannelSelector', 'R');
  feDisp.setAttribute('yChannelSelector', 'G');
  feDisp.setAttribute('scale', String(INK_CREST_PX));
  filter.append(feImage, feDisp);
  svg.append(filter);
  document.body.append(svg);

  button.style.filter = previousFilter ? `${previousFilter} url(#${id})` : `url(#${id})`;
  let frame = 0;
  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    inkJobs.delete(button);
    if (button.style.filter.includes(id)) button.style.filter = previousFilter;
    svg.remove();
  };
  inkJobs.set(button, { stop: finish });

  const start = performance.now();
  const tick = (now: number) => {
    if (stopped) return;
    const phase = rippleEase((now - start) / RIPPLE_MS);
    if (phase >= 1) {
      finish();
      return;
    }
    try {
      paintInkMap(image.data, INK_MAP_SIZE, phase, rect.width, rect.height);
      ctx.putImageData(image, 0, 0);
      const url = canvas.toDataURL();
      feImage.setAttribute('href', url);
      feImage.setAttributeNS(XLINK_NS, 'href', url);
    } catch {
      finish();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
}

export function spawnClickBurst(x: number, y: number, rich: boolean, button: HTMLButtonElement): BurstSpec | null {
  if (prefersReducedMotion()) return null;
  const clip = clipOf(button);
  const ripple = placeRipple(clip, x, y);
  const burst: BurstSpec = {
    id: nextId++,
    x,
    y,
    rich,
    rippleX: ripple.x,
    rippleY: ripple.y,
    rippleDiameter: ripple.diameter,
    clip,
  };
  clickBursts.value = [...clickBursts.value, burst];
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    clickBursts.value = clickBursts.value.filter((item) => item.id !== burst.id);
  }, CLICK_BURST_MS);
  timers.add(timer);
  beginInkRipple(button);
  return burst;
}

/** 鼠标和触摸在按下的瞬间播。右键不播。 */
export function burstFromPointer(event: PointerEvent): BurstSpec | null {
  if (event.button !== 0) return null;
  const button = buttonFromTarget(event.target);
  const kind = button ? burstKind(button) : null;
  if (!kind) return null;
  return spawnClickBurst(event.clientX, event.clientY, kind === 'rich', button);
}

/**
 * 键盘确认按钮时没有 pointerdown。
 * detail 为 0 才是键盘或脚本；鼠标松开后的 click 已经在按下时播过。
 */
export function burstFromClick(event: MouseEvent): BurstSpec | null {
  if (event.detail !== 0) return null;
  const button = buttonFromTarget(event.target);
  const kind = button ? burstKind(button) : null;
  if (!kind) return null;
  const rect = button.getBoundingClientRect();
  return spawnClickBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, kind === 'rich', button);
}
