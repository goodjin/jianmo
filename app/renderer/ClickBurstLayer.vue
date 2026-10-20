<template>
  <Teleport to="body">
    <div class="click-burst-layer" aria-hidden="true">
      <div
        v-for="burst in clickBursts"
        :key="burst.id"
        class="click-burst"
        :class="{ 'is-rich': burst.rich }"
        :style="{ left: burst.x + 'px', top: burst.y + 'px' }"
      >
        <span class="click-wave"></span>
        <span class="click-ripple"></span>
        <span class="click-ripple click-ripple-late"></span>
        <template v-for="(star, index) in burst.stars" :key="index">
          <svg
            v-if="star.shape === 'star'"
            class="click-star"
            viewBox="0 0 16 16"
            :style="starStyle(star)"
          >
            <path d="M8 .4C8.4 5.2 8.8 6.6 13.6 7.2 8.8 7.8 8.4 9.2 8 15.6 7.6 9.2 7.2 7.8 2.4 7.2 7.2 6.6 7.6 5.2 8 .4Z" />
          </svg>
          <span v-else class="click-star click-dot" :style="starStyle(star)"></span>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  burstFromClick,
  burstFromPointer,
  clearClickBursts,
  clickBursts,
  type StarSpec,
} from './clickBurst';

function starStyle(star: StarSpec): Record<string, string> {
  return {
    width: `${star.size}px`,
    height: `${star.size}px`,
    color: star.color,
    background: star.shape === 'dot' ? star.color : 'transparent',
    animationDelay: `${star.delay}ms`,
    '--dx': `${star.dx}px`,
    '--dy': `${star.dy}px`,
    '--spin': `${star.spin}deg`,
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
  width: 0;
  height: 0;
  overflow: visible;
}
.click-wave,
.click-ripple {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 50%;
}
.click-wave {
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.92) 0%, rgba(126, 182, 255, 0.42) 46%, rgba(126, 182, 255, 0) 72%);
  animation: click-wave-out 500ms ease-out forwards;
}
.click-ripple {
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 1.6px solid rgba(126, 182, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.75);
  animation: click-ripple-out 540ms cubic-bezier(0.16, 0.7, 0.22, 1) forwards;
}
.click-ripple-late {
  animation-delay: 110ms;
  border-width: 1.15px;
  opacity: 0.85;
}
.click-burst.is-rich .click-wave {
  background: radial-gradient(circle, rgba(255, 248, 214, 0.96) 0%, rgba(246, 196, 69, 0.5) 42%, rgba(246, 196, 69, 0) 72%);
  animation-duration: 600ms;
}
.click-burst.is-rich .click-ripple {
  border-color: rgba(246, 196, 69, 0.95);
  box-shadow: 0 0 0 1px rgba(255, 248, 214, 0.9), 0 0 8px rgba(246, 196, 69, 0.35);
  animation-name: click-ripple-rich;
  animation-duration: 640ms;
}
.click-burst.is-rich .click-ripple-late {
  animation-delay: 120ms;
}
.click-star {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  overflow: visible;
  animation: click-star-fly 640ms cubic-bezier(0.16, 0.72, 0.2, 1) forwards;
}
.click-star path {
  fill: currentColor;
}
.click-dot {
  border-radius: 50%;
  box-shadow: 0 0 4px currentColor;
}
@keyframes click-wave-out {
  0% { transform: scale(0.15); opacity: 0.95; }
  100% { transform: scale(3.6); opacity: 0; }
}
@keyframes click-ripple-out {
  0% { transform: scale(0.25); opacity: 0.9; }
  100% { transform: scale(4.4); opacity: 0; }
}
@keyframes click-ripple-rich {
  0% { transform: scale(0.2); opacity: 0.95; }
  100% { transform: scale(5.8); opacity: 0; }
}
@keyframes click-star-fly {
  0% {
    transform: translate(-50%, -50%) scale(0.15) rotate(0deg);
    opacity: 0;
  }
  24% {
    opacity: 1;
    transform: translate(calc(-50% + var(--dx) * 0.42), calc(-50% + var(--dy) * 0.42)) scale(1) rotate(calc(var(--spin) * 0.35));
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2) rotate(var(--spin));
  }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
