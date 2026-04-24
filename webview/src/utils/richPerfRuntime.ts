import type { RichPerfTier } from './richPerfTier';

/** 由 Milkdown 侧随 props 更新，供 shiki 等 sync 路径读取 */
let runtimeTier: RichPerfTier = 0;

export function setRuntimeRichPerfTier(t: RichPerfTier): void {
  runtimeTier = t;
}

export function getRuntimeRichPerfTier(): RichPerfTier {
  return runtimeTier;
}
