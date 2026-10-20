/**
 * 桌面壳层按钮被点下时，从指尖冒一圈水波，再散开几颗小星星。
 * 复制更热闹一点。画在 body 上，避免被顶栏或文件树裁掉。
 * 文件列表和右键菜单不跟。系统开了「减少动效」就不播。
 */

import { ref } from 'vue';

export const CLICK_BURST_MS = 780;

/** 这些是壳层上的操作按钮。文件行、最近打开里的文件名不算。 */
export const PLAIN_BURST_CLASSES = [
  'chrome-btn',
  'file-icon-btn',
  'file-toggle',
  'tab-new',
  'tab-close',
  'doc-outline-toggle',
  'export-item',
  'theme-card',
  'font-picker-button',
  'font-option',
  'recent-clear',
  'recent-icon',
  'recent-more',
] as const;

const RICH_COLORS = ['#f6c445', '#fff6c8', '#ffe08a', '#ffd0ea', '#ffffff'];
const PLAIN_COLORS = ['#7eb6ff', '#d7e8ff', '#f6c445', '#ffffff', '#b9d4ff'];

export type StarShape = 'star' | 'dot';

export type StarSpec = {
  dx: number;
  dy: number;
  delay: number;
  size: number;
  spin: number;
  color: string;
  shape: StarShape;
};

export type BurstSpec = {
  id: number;
  x: number;
  y: number;
  rich: boolean;
  stars: StarSpec[];
};

export type BurstKind = 'rich' | 'plain';

export const clickBursts = ref<BurstSpec[]>([]);

const timers = new Set<number>();
let nextId = 1;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function makeStars(rich: boolean, rand: () => number = Math.random): StarSpec[] {
  const count = rich ? 8 : 5;
  const colors = rich ? RICH_COLORS : PLAIN_COLORS;
  const base = rich ? 22 : 14;
  const spread = rich ? 20 : 12;
  const stars: StarSpec[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (rand() - 0.5) * 0.7;
    const dist = base + rand() * spread;
    stars.push({
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: rand() * 50,
      size: (rich ? 8 : 6) + rand() * (rich ? 4 : 2.5),
      spin: (i % 2 === 0 ? 1 : -1) * (28 + rand() * 40),
      color: colors[i % colors.length]!,
      shape: i % 3 === 2 ? 'dot' : 'star',
    });
  }
  return stars;
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

export function spawnClickBurst(x: number, y: number, rich: boolean): BurstSpec | null {
  if (prefersReducedMotion()) return null;
  const burst: BurstSpec = {
    id: nextId++,
    x,
    y,
    rich,
    stars: makeStars(rich),
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
  return spawnClickBurst(event.clientX, event.clientY, kind === 'rich');
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
  return spawnClickBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, kind === 'rich');
}
