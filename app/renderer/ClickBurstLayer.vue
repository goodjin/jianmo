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
              :style="ringStyle(burst, wave.portion, wave.delay)"
            >
              <circle class="click-ripple-halo" :cx="half(burst)" :cy="half(burst)" />
              <circle class="click-ripple-line" :cx="half(burst)" :cy="half(burst)" />
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
  RIPPLE_WAVES,
  ringRadius,
  burstFromClick,
  burstFromPointer,
  clearClickBursts,
  clickBursts,
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

function half(burst: BurstSpec): number {
  return burst.rippleDiameter / 2;
}

function svgStyle(burst: BurstSpec): Record<string, string> {
  const radius = half(burst);
  return {
    left: `${burst.rippleX - burst.clip.left - radius}px`,
    top: `${burst.rippleY - burst.clip.top - radius}px`,
  };
}

function ringStyle(burst: BurstSpec, portion: number, delay: number): Record<string, string> {
  return {
    '--ring-r': `${ringRadius(burst.rippleDiameter, portion)}px`,
    animationDelay: `${delay}ms`,
  };
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
.click-ripple-halo,
.click-ripple-line {
  fill: none;
  vector-effect: non-scaling-stroke;
  animation: click-ring-out 820ms cubic-bezier(0.16, 0.55, 0.22, 1) both;
  animation-delay: inherit;
}
.click-ripple-halo {
  stroke: rgba(168, 204, 228, 0.18);
  stroke-width: 1.8;
}
.click-ripple-line {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-width: 1;
}
@keyframes click-ring-out {
  0% { r: 0.6px; opacity: 0; }
  14% { opacity: 0.8; }
  100% { r: var(--ring-r); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
