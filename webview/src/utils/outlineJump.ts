/**
 * 大纲跳转的纯函数封装
 * @module utils/outlineJump
 *
 * @description
 * 把 App.vue 里 `handleOutlineJump` 的核心副作用（移动光标 + 触发滚动）
 * 抽到这里，便于在不挂载整张 App.vue 的情况下做单元测试。
 *
 * 历史 bug 备忘（已修复，见 commit message）：
 * - Source 模式之前用 `scroller.scrollTop = coords.top - scroller.clientTop - 20`
 *   把 viewport 坐标误当成 scroller 内偏移。
 *   当 heading 在屏幕外上方时结果为负，浏览器 clamp 到 0，**完全没滚动**；
 *   当 heading 在屏幕外下方时缺少当前 scrollTop 基线，**滚动量不足**。
 *   改用 CM6 的 `scrollIntoView: true` 让编辑器自己滚（与查找跳转同一写法）。
 * - Rich 模式之前只 `nextTick + rAF` 调用一次 `scrollToHeading`，
 *   heading DOM 晚于编辑器 ready 时找不到元素直接 return → 静默失败。
 *   改为多帧重试 + caller 传入 fallback pos 走 ProseMirror `scrollIntoView` 兜底。
 */

import type { EditorView } from '@codemirror/view';

/**
 * Source / IR：把光标移到 `pos` 并让 CM6 把选区滚到视口可见位置。
 *
 * @param view CM6 EditorView；为 null/undefined 时静默 return
 * @param pos  目标文档位置（heading 行的 `from`）
 */
export function jumpCaretIntoView(view: EditorView | null | undefined, pos: number): void {
  if (!view) return;
  view.dispatch({
    selection: { anchor: pos },
    scrollIntoView: true,
  });
  view.focus();
}

/**
 * Rich 跳转一次的实际执行；返回 true 表示已成功把 heading 滚到视口。
 * 调用方负责"heading 元素查找 + 滚动 + fallback pos"，本函数只关心返回值。
 */
export type RichJumpAttempt = () => boolean;

/** Rich 模式多帧重试调度器（默认 `requestAnimationFrame`）。 */
export type RichJumpScheduler = (cb: () => void) => void;

export interface JumpRichWithRetryDeps {
  /** 单次尝试；返回 true 表示成功 */
  attempt: RichJumpAttempt;
  /** 自定义调度（默认 rAF），便于在 jsdom 下用 setTimeout(..., 0) */
  schedule?: RichJumpScheduler;
  /** 最大尝试次数（含首次）；默认 5 */
  maxAttempts?: number;
  /** 全部尝试失败后调用（用于 toast 等 UI 提示） */
  onGiveUp?: () => void;
}

/**
 * Rich：多次调用 `deps.attempt`，任一次返回 true 即停止；超过 maxAttempts 仍失败则回调 onGiveUp。
 * 与 App.vue 中"刚切到 rich / 大纲与文档状态不同步"等竞态场景配套使用：
 * heading DOM 元素可能需要若干帧才会出现在 `.milkdown-editor` 里。
 */
export function jumpRichWithRetry(deps: JumpRichWithRetryDeps): void {
  const schedule: RichJumpScheduler = deps.schedule ?? ((cb) => requestAnimationFrame(cb));
  const max = Math.max(1, deps.maxAttempts ?? 5);
  let attempts = 0;
  const tryOnce = (): void => {
    if (deps.attempt()) return;
    attempts++;
    if (attempts < max) {
      schedule(tryOnce);
    } else {
      deps.onGiveUp?.();
    }
  };
  tryOnce();
}