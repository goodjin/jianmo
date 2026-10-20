/**
 * 桌面壳层按钮被点下时，从指尖荡开几圈水波。
 * 波峰把按钮上的字往外推、波谷再拉回来，像水在纸面上走过。
 * 水波画在 body 上，按按钮圆角裁住，不超出按钮边。
 * 文件列表和右键菜单不跟。系统开了「减少动效」就不播。
 */

import { ref } from 'vue';

export const CLICK_BURST_MS = 1100;

/** 水波从这么大的圆放大到按钮较短的一边，不再超出按钮。 */
export const RIPPLE_BASE_PX = 12;

/** 连续三圈。后面的更小、更晚，都收在按钮里面。 */
export const RIPPLE_WAVES = [
  { portion: 1, delay: 0 },
  { portion: 0.72, delay: 150 },
  { portion: 0.46, delay: 300 },
] as const;

/** 字跟着水波走的时间。播完把滤镜卸掉，字回到原处。 */
export const INK_RIPPLE_MS = 980;

/** 波峰处字被推开的像素。再大就会把字揉糊。 */
export const INK_CREST_PX = 2.5;

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
};

export type BurstKind = 'rich' | 'plain';

export const clickBursts = ref<BurstSpec[]>([]);

const timers = new Set<number>();
const inkJobs = new Map<HTMLButtonElement, { stop: () => void }>();
let nextId = 1;
let inkSeq = 1;

const INK_MAP_SIZE = 64;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** 整段里波峰有多强。开头和结尾是 0，字不会停在歪的位置。 */
export function inkAmplitude(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0;
  const fadeIn = Math.min(1, phase / 0.12);
  const fadeOut = Math.min(1, (1 - phase) / 0.22);
  return fadeIn * fadeOut * INK_CREST_PX;
}

/**
 * 点击处为原点，距离按按钮对边大约为 1。
 * 正值是波峰把这一点往外推，负值是波谷把它拉回来。波列随 phase 向外走。
 */
export function inkPush(dx: number, dy: number, phase: number): number {
  const dist = Math.hypot(dx, dy);
  const front = 0.05 + clamp(phase, 0, 1) * 1.12;
  const wavelength = 0.34;
  const signed = Math.sin(((dist - front) / wavelength) * Math.PI * 2);
  const sigma = 0.16;
  const band = Math.exp(-((dist - front) ** 2) / (2 * sigma * sigma));
  return signed * band;
}

/**
 * 把水波画成一张推移贴图。红是左右，绿是上下，128 表示不动。
 * 波峰沿远离点击处的方向推，波谷拉回来。
 */
export function paintInkMap(
  data: Uint8ClampedArray,
  size: number,
  originX: number,
  originY: number,
  phase: number,
): void {
  if (size < 2 || data.length < size * size * 4) return;
  const ox = clamp(originX, 0, 1);
  const oy = clamp(originY, 0, 1);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const dx = u - ox;
      const dy = v - oy;
      const dist = Math.hypot(dx, dy) || 1;
      const push = inkPush(dx, dy, phase);
      const i = (y * size + x) * 4;
      data[i] = clampByte(128 + (dx / dist) * push * 127);
      data[i + 1] = clampByte(128 + (dy / dist) * push * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
}

/**
 * 水波是正圆，直径用按钮较短的一边。
 * 点在边上时，圆心往里收，整圈都落在按钮里。
 */
export function placeRipple(box: ButtonBox, x: number, y: number): { x: number; y: number; diameter: number } {
  const diameter = Math.max(0, Math.min(box.width, box.height));
  const radius = diameter / 2;
  return {
    x: clamp(x, box.left + radius, box.left + box.width - radius),
    y: clamp(y, box.top + radius, box.top + box.height - radius),
    diameter,
  };
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
 * 在按钮自己身上贴一层水波，字会被波峰往外推一下。
 * 画布不可用时只留下标记，不硬做。播完一定卸掉滤镜。
 */
export function beginInkRipple(button: HTMLButtonElement, clientX: number, clientY: number): void {
  if (prefersReducedMotion() || !button.isConnected) return;
  const previous = inkJobs.get(button);
  if (previous) previous.stop();

  const rect = button.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;

  button.classList.add('is-ink-rippling');
  const previousFilter = button.style.filter;
  const id = `markly-ink-${inkSeq++}`;
  let svg: SVGSVGElement | null = null;
  let frame = 0;
  let timer = 0;
  let stopped = false;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    if (timer) window.clearTimeout(timer);
    inkJobs.delete(button);
    button.classList.remove('is-ink-rippling');
    if (button.style.filter.includes(id)) button.style.filter = previousFilter;
    svg?.remove();
  };

  inkJobs.set(button, { stop: finish });

  const canvas = document.createElement('canvas');
  canvas.width = INK_MAP_SIZE;
  canvas.height = INK_MAP_SIZE;
  let ctx: CanvasRenderingContext2D | null = null;
  const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  if (!jsdom) {
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
  }
  if (!ctx) {
    timer = window.setTimeout(finish, INK_RIPPLE_MS);
    return;
  }

  let image: ImageData;
  try {
    image = ctx.createImageData(INK_MAP_SIZE, INK_MAP_SIZE);
  } catch {
    timer = window.setTimeout(finish, INK_RIPPLE_MS);
    return;
  }

  const originX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const originY = clamp((clientY - rect.top) / rect.height, 0, 1);
  svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'markly-ink-defs');
  svg.setAttribute('aria-hidden', 'true');
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
  feDisp.setAttribute('scale', '0');
  filter.append(feImage, feDisp);
  svg.append(filter);
  document.body.append(svg);

  const applied = previousFilter ? `${previousFilter} url(#${id})` : `url(#${id})`;
  button.style.filter = applied;
  const start = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const t = (now - start) / INK_RIPPLE_MS;
    if (t >= 1) {
      finish();
      return;
    }
    try {
      paintInkMap(image.data, INK_MAP_SIZE, originX, originY, t);
      ctx.putImageData(image, 0, 0);
      const url = canvas.toDataURL();
      feImage.setAttribute('href', url);
      feImage.setAttributeNS(XLINK_NS, 'href', url);
      feDisp.setAttribute('scale', (inkAmplitude(t) * 2).toFixed(2));
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
  beginInkRipple(button, x, y);
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
