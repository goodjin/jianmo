<template>
  <Teleport to="body">
    <div class="click-burst-layer" aria-hidden="true">
      <div
        v-for="burst in clickBursts"
        :key="burst.id"
        class="click-burst"
        :class="{ 'is-rich': burst.rich }"
      >
        <div class="click-ripple-clip" :style="clipStyle(burst)">
          <canvas class="click-ripple-canvas" :data-id="burst.id" :style="canvasStyle(burst)" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import {
  burstFromClick,
  burstFromPointer,
  clearClickBursts,
  clickBursts,
  paintRidgeImage,
  type BurstSpec,
} from './clickBurst';

function clipStyle(burst: BurstSpec): Record<string, string> {
  return {
    left: `${burst.clip.left}px`,
    top: `${burst.clip.top}px`,
    width: `${burst.clip.width}px`,
    height: `${burst.clip.height}px`,
    borderRadius: burst.clip.radius,
  };
}

function canvasStyle(burst: BurstSpec): Record<string, string> {
  const radius = burst.rippleDiameter / 2;
  return {
    left: `${burst.rippleX - burst.clip.left - radius}px`,
    top: `${burst.rippleY - burst.clip.top - radius}px`,
    width: `${burst.rippleDiameter}px`,
    height: `${burst.rippleDiameter}px`,
  };
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

let raf = 0;

function paintAll(now: number): void {
  const nodes = document.querySelectorAll<HTMLCanvasElement>('.click-ripple-canvas');
  if (nodes.length === 0) {
    raf = 0;
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  nodes.forEach((canvas) => {
    const burst = clickBursts.value.find((item) => item.id === Number(canvas.dataset.id));
    if (!burst) return;
    if (burst.bornAt == null) burst.bornAt = now;
    const ctx = contextOf(canvas);
    if (!ctx) return;
    const backing = Math.max(1, Math.round(burst.rippleDiameter * dpr));
    if (canvas.width !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    const image = ctx.getImageData(0, 0, backing, backing);
    paintRidgeImage(image.data, backing, now - burst.bornAt, burst.rippleDiameter);
    ctx.putImageData(image, 0, 0);
  });
  raf = requestAnimationFrame(paintAll);
}

function arm(): void {
  if (raf !== 0 || clickBursts.value.length === 0) return;
  raf = requestAnimationFrame(paintAll);
}

watch(clickBursts, arm, { flush: 'post' });

function onPointerDown(event: PointerEvent): void {
  burstFromPointer(event);
}

function onClick(event: MouseEvent): void {
  burstFromClick(event);
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
  arm();
});

onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('click', onClick, true);
  if (raf !== 0) cancelAnimationFrame(raf);
  raf = 0;
  clearClickBursts();
});
</script>

<style>
.click-burst-layer,
.click-burst-layer * {
  pointer-events: none;
}
.click-burst-layer {
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: 60;
  overflow: visible;
}
.click-burst {
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  overflow: visible;
}
.click-ripple-clip {
  position: fixed;
  overflow: hidden;
}
.click-ripple-canvas {
  position: absolute;
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
