<template>
  <div
    v-if="open"
    class="mermaid-viewer"
    role="dialog"
    aria-modal="true"
    aria-label="图表查看器"
    @keydown.esc.stop.prevent="$emit('close')"
  >
    <div class="mermaid-viewer-backdrop" @click="$emit('close')" />
    <div class="mermaid-viewer-panel">
      <header class="mermaid-viewer-bar">
        <div class="mermaid-viewer-tools" role="toolbar" aria-label="图表缩放">
          <button type="button" class="mv-btn" title="缩小" aria-label="缩小" @click="zoomOut">−</button>
          <span class="mv-zoom">{{ Math.round(zoom * 100) }}%</span>
          <button type="button" class="mv-btn" title="放大" aria-label="放大" @click="zoomIn">+</button>
          <button type="button" class="mv-btn" title="适应窗口" aria-label="适应窗口" @click="fit">适应</button>
          <button type="button" class="mv-btn" title="重置 100%" aria-label="重置缩放" @click="resetZoom">1×</button>
          <button
            type="button"
            class="mv-btn"
            title="复制源码"
            aria-label="复制源码"
            :disabled="!source"
            @click="copySource"
          >复制源码</button>
        </div>
        <button type="button" class="mv-btn mv-close" title="关闭" aria-label="关闭" @click="$emit('close')">×</button>
      </header>
      <p v-if="copied" class="mv-toast" role="status">已复制源码</p>
      <div
        ref="stageRef"
        class="mermaid-viewer-stage"
        @pointerdown="onPanStart"
        @wheel.prevent="onWheel"
      >
        <div
          class="mermaid-viewer-canvas"
          :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }"
          v-html="safeSvg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { clampMermaidZoom } from './reading/mermaidViewer';
import { electronApp } from './electronBridge';

const props = defineProps<{
  open: boolean;
  svg: string;
  source: string;
}>();

defineEmits<{ (e: 'close'): void }>();

const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const copied = ref(false);
const stageRef = ref<HTMLElement | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
let panning = false;
let lastX = 0;
let lastY = 0;

const safeSvg = computed(() => {
  const raw = props.svg || '';
  if (!raw.includes('<svg')) {
    return `<pre class="mv-fallback">${escapeHtml(props.source || '（无图表）')}</pre>`;
  }
  return raw;
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function zoomIn(): void {
  zoom.value = clampMermaidZoom(zoom.value * 1.25);
}
function zoomOut(): void {
  zoom.value = clampMermaidZoom(zoom.value / 1.25);
}
function resetZoom(): void {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}
function fit(): void {
  const stage = stageRef.value;
  const svg = stage?.querySelector('svg');
  if (!stage || !svg) {
    resetZoom();
    return;
  }
  const sw = stage.clientWidth - 32;
  const sh = stage.clientHeight - 32;
  const box = svg.getBoundingClientRect();
  // getBoundingClientRect includes current transform; use intrinsic size when possible
  const iw = Number(svg.getAttribute('width')) || svg.viewBox?.baseVal?.width || box.width / Math.max(zoom.value, 0.01);
  const ih = Number(svg.getAttribute('height')) || svg.viewBox?.baseVal?.height || box.height / Math.max(zoom.value, 0.01);
  if (!(iw > 0 && ih > 0 && sw > 0 && sh > 0)) {
    resetZoom();
    return;
  }
  zoom.value = clampMermaidZoom(Math.min(sw / iw, sh / ih));
  panX.value = 0;
  panY.value = 0;
}

function onWheel(ev: WheelEvent): void {
  const factor = ev.deltaY > 0 ? 0.9 : 1.1;
  zoom.value = clampMermaidZoom(zoom.value * factor);
}

function onPanStart(ev: PointerEvent): void {
  if (ev.button !== 0) return;
  panning = true;
  lastX = ev.clientX;
  lastY = ev.clientY;
  const stage = stageRef.value;
  stage?.setPointerCapture?.(ev.pointerId);
  const move = (e: PointerEvent) => {
    if (!panning) return;
    panX.value += e.clientX - lastX;
    panY.value += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const up = () => {
    panning = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

async function copySource(): Promise<void> {
  if (!props.source) return;
  const api = electronApp();
  try {
    if (api?.copyExactText) await api.copyExactText(props.source);
    else await navigator.clipboard.writeText(props.source);
    copied.value = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
      copiedTimer = null;
    }, 1200);
  } catch {
    /* ignore */
  }
}

watch(
  () => props.open,
  (on) => {
    if (on) {
      zoom.value = 1;
      panX.value = 0;
      panY.value = 0;
      copied.value = false;
    }
  }
);
</script>

<style scoped>
.mermaid-viewer {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}
.mermaid-viewer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
}
.mermaid-viewer-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(960px, calc(100vw - 48px));
  height: min(720px, calc(100vh - 48px));
  margin: auto;
  border-radius: var(--app-radius-lg, 12px);
  background: var(--markly-background, #fff);
  color: var(--markly-text, #1f2328);
  border: 1px solid var(--markly-border-color, #d0d7de);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}
.mermaid-viewer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
  background: var(--markly-surface, #f6f8fa);
}
.mermaid-viewer-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.mv-btn {
  min-width: 32px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm, 6px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.mv-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--markly-primary, #0969da) 12%, transparent);
}
.mv-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.mv-close {
  font-size: 18px;
  line-height: 1;
}
.mv-zoom {
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  color: var(--markly-textSecondary, #57606a);
}
.mv-toast {
  margin: 0;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--markly-textSecondary, #57606a);
}
.mermaid-viewer-stage {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  background: var(--markly-background, #fff);
  touch-action: none;
}
.mermaid-viewer-stage:active {
  cursor: grabbing;
}
.mermaid-viewer-canvas {
  transform-origin: center center;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mermaid-viewer-canvas :deep(svg) {
  max-width: none;
  height: auto;
}
.mv-fallback {
  margin: 24px;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .mermaid-viewer-canvas {
    transition: none;
  }
}
</style>
