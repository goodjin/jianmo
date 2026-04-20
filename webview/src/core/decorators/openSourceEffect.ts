/**
 * 打开源码视图的统一 Effect
 * @module core/decorators/openSourceEffect
 * @description 点击可视化 widget 时，通过 effect 通知装饰器回退源码（避免 atomic range 无法把光标放进范围内）。
 */

import { StateEffect } from '@codemirror/state';

export interface OpenSourceRange {
  from: number;
  to: number;
}

export const openSourceAtRangeEffect = StateEffect.define<OpenSourceRange>();

