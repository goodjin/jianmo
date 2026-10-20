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
          <div class="click-ripple-origin" :style="originStyle(burst)">
            <span class="click-wave" :style="rippleStyle(burst)"></span>
            <span
              v-for="wave in RIPPLE_WAVES"
              :key="wave.delay"
              class="click-ripple"
              :style="rippleStyle(burst, wave.portion, wave.delay)"
            ></span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  RIPPLE_BASE_PX,
  RIPPLE_WAVES,
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

function originStyle(burst: BurstSpec): Record<string, string> {
  return {
    left: `${burst.rippleX - burst.clip.left}px`,
    top: `${burst.rippleY - burst.clip.top}px`,
  };
}

function rippleStyle(burst: BurstSpec, portion = 1, delay = 0): Record<string, string> {
  const scale = burst.rippleDiameter / RIPPLE_BASE_PX * portion;
  return {
    '--ripple-scale': String(scale),
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
.click-ripple-origin {
  position: absolute;
  width: 0;
  height: 0;
}
.click-wave,
.click-ripple {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
}
.click-wave {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(186, 216, 240, 0.16) 42%, rgba(186, 216, 240, 0) 70%);
  animation: click-ripple-out 380ms ease-out forwards;
}
.click-ripple {
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0) 58%,
    rgba(255, 255, 255, 0.82) 70%,
    rgba(176, 210, 236, 0.34) 76%,
    rgba(70, 100, 130, 0.16) 82%,
    rgba(255, 255, 255, 0) 90%
  );
  animation: click-ripple-out 760ms cubic-bezier(0.12, 0.55, 0.2, 1) forwards;
}
.markly-ink-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
@keyframes click-ripple-out {
  0% { transform: scale(0.08); opacity: 0.15; }
  20% { opacity: 0.9; }
  100% { transform: scale(var(--ripple-scale, 1)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
