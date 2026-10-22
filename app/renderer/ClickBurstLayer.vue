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

/** 从外到里叠成一道细水纹。四层靠得很近，整条大约两像素，透出底下的字。 */
const RIPPLE_BANDS = [
  { name: 'click-ripple-shade', inset: 0 },
  { name: 'click-ripple-face', inset: 0.45 },
  { name: 'click-ripple-line', inset: 0.9 },
  { name: 'click-ripple-trough', inset: 1.35 },
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
  stroke: rgba(36, 104, 150, 0.34);
  stroke-width: 1.25;
}
.click-ripple-face {
  stroke: rgba(176, 220, 238, 0.42);
  stroke-width: 0.9;
}
.click-ripple-line {
  stroke: rgba(255, 255, 255, 0.62);
  stroke-width: 0.5;
}
.click-ripple-trough {
  stroke: rgba(28, 78, 118, 0.28);
  stroke-width: 0.65;
}
@keyframes click-ring-out {
  0% { r: 0.6px; }
  100% { r: var(--ring-r); }
}
@keyframes click-ring-fade {
  0% { opacity: 0; }
  14% { opacity: 0; }
  24% { opacity: 0.7; }
  70% { opacity: 0.5; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
