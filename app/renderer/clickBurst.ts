/**
 * 桌面壳层按钮被点下时，从指尖荡开几圈细的正圆水波。
 * 圈是矢量描边，不把小色块放大，也不扭曲按钮。
 * 画在 body 上，按按钮圆角裁住，不超出按钮边。
 * 文件列表和右键菜单不跟。系统开了「减少动效」就不播。
 */

import { ref } from 'vue';

export const CLICK_BURST_MS = 980;

/** 连续三圈细线。后面的更小、更晚，直径都不超过按钮较短的一边。 */
export const RIPPLE_WAVES = [
  { portion: 1, delay: 0 },
  { portion: 0.68, delay: 160 },
  { portion: 0.4, delay: 320 },
] as const;

/** 描边画在半径两侧。半径收进这一截，整条细线才落在按钮里面。 */
export const RIPPLE_EDGE_PAD = 1;

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
};

export type BurstKind = 'rich' | 'plain';

export const clickBursts = ref<BurstSpec[]>([]);

const timers = new Set<number>();
let nextId = 1;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
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
  clickBursts.value = [];
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
