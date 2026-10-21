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
          <svg
            class="click-ripple-svg"
            :width="burst.rippleDiameter"
            :height="burst.rippleDiameter"
            :viewBox="`0 0 ${burst.rippleDiameter} ${burst.rippleDiameter}`"
            :style="svgStyle(burst)"
          >
            <g
              v-for="wave in RIPPLE_WAVES"
              :key="wave.delay"
              class="click-ripple"
              :style="{ '--ripple-delay': `${wave.delay}ms` }"
            >
              <circle
                v-for="band in RIPPLE_BANDS"
                :key="band.name"
                :class="band.name"
                :cx="half(burst)"
                :cy="half(burst)"
                :style="ringStyle(burst, wave.portion, band.inset)"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  RIPPLE_EASE,
  RIPPLE_MS,
  RIPPLE_WAVES,
  ringRadius,
  burstFromClick,
  burstFromPointer,
  clearClickBursts,
  clickBursts,
  type BurstSpec,
} from './clickBurst';

/** 从外到里：外缘暗、水色、亮边、内侧暗。叠成一道有厚度的波，不是一根线。 */
const RIPPLE_BANDS = [
  { name: 'click-ripple-shade', inset: 0 },
  { name: 'click-ripple-face', inset: 1.6 },
  { name: 'click-ripple-line', inset: 2.8 },
  { name: 'click-ripple-trough', inset: 4.2 },
] as const;

function clipStyle(burst: BurstSpec): Record<string, string> {
  return {
    left: `${burst.clip.left}px`,
    top: `${burst.clip.top}px`,
    width: `${burst.clip.width}px`,
    height: `${burst.clip.height}px`,
    borderRadius: burst.clip.radius,
  };
}

function half(burst: BurstSpec): number {
  return burst.rippleDiameter / 2;
}

function svgStyle(burst: BurstSpec): Record<string, string> {
  const radius = half(burst);
  return {
    left: `${burst.rippleX - burst.clip.left - radius}px`,
    top: `${burst.rippleY - burst.clip.top - radius}px`,
    '--ripple-ms': `${RIPPLE_MS}ms`,
    '--ripple-ease': `cubic-bezier(${RIPPLE_EASE.x1}, ${RIPPLE_EASE.y1}, ${RIPPLE_EASE.x2}, ${RIPPLE_EASE.y2})`,
  };
}

function ringStyle(burst: BurstSpec, portion: number, inset: number): Record<string, string> {
  const radius = Math.max(0.6, ringRadius(burst.rippleDiameter, portion) - inset);
  return { '--ring-r': `${radius}px` };
}

function onPointerDown(event: PointerEvent): void {
  burstFromPointer(event);
}

function onClick(event: MouseEvent): void {
  burstFromClick(event);
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
});

onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('click', onClick, true);
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
.click-ripple-svg {
  position: absolute;
  overflow: visible;
  shape-rendering: geometricPrecision;
}
.click-ripple-shade,
.click-ripple-face,
.click-ripple-line,
.click-ripple-trough {
  fill: none;
  vector-effect: non-scaling-stroke;
  animation-name: click-ring-out, click-ring-fade;
  animation-duration: var(--ripple-ms, 720ms), var(--ripple-ms, 720ms);
  animation-timing-function: var(--ripple-ease, cubic-bezier(0.22, 0.68, 0.2, 1)), linear;
  animation-fill-mode: both, both;
  animation-delay: var(--ripple-delay, 0ms), var(--ripple-delay, 0ms);
}
.click-ripple-shade {
  stroke: rgba(16, 64, 110, 0.62);
  stroke-width: 2.6;
}
.click-ripple-face {
  stroke: rgba(116, 194, 226, 0.82);
  stroke-width: 1.9;
}
.click-ripple-line {
  stroke: rgba(255, 255, 255, 0.98);
  stroke-width: 1.05;
}
.click-ripple-trough {
  stroke: rgba(12, 48, 84, 0.5);
  stroke-width: 1.35;
}
@keyframes click-ring-out {
  0% { r: 0.6px; }
  100% { r: var(--ring-r); }
}
@keyframes click-ring-fade {
  0% { opacity: 0; }
  14% { opacity: 0; }
  24% { opacity: 0.95; }
  70% { opacity: 0.82; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
