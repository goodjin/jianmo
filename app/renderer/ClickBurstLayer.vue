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
            <span class="click-ripple" :style="rippleStyle(burst)"></span>
            <span class="click-ripple click-ripple-late" :style="rippleStyle(burst, 0.68)"></span>
          </div>
        </div>
        <div class="click-star-origin" :style="{ left: burst.x + 'px', top: burst.y + 'px' }">
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
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  RIPPLE_BASE_PX,
  burstFromClick,
  burstFromPointer,
  clearClickBursts,
  clickBursts,
  type BurstSpec,
  type StarSpec,
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

function rippleStyle(burst: BurstSpec, portion = 1): Record<string, string> {
  const scale = burst.rippleDiameter / RIPPLE_BASE_PX * portion;
  return { '--ripple-scale': String(scale) };
}

function starStyle(star: StarSpec): Record<string, string> {
  return {
    width: `${star.size}px`,
    height: `${star.size}px`,
    color: star.color,
    background: star.shape === 'dot' ? star.color : 'transparent',
    animationDelay: `${star.delay}ms`,
    '--star-alpha': String(star.alpha),
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
.click-ripple-origin,
.click-star-origin {
  position: absolute;
  width: 0;
  height: 0;
}
.click-star-origin { position: fixed; }
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
  background: radial-gradient(circle, rgba(255, 255, 255, 0.38) 0%, rgba(186, 214, 255, 0.14) 52%, rgba(186, 214, 255, 0) 74%);
  animation: click-ripple-out 480ms ease-out forwards;
}
.click-ripple {
  border: 1px solid rgba(168, 202, 245, 0.5);
  animation: click-ripple-out 620ms cubic-bezier(0.16, 0.7, 0.22, 1) forwards;
}
.click-ripple-late {
  animation-delay: 90ms;
  border-width: 1px;
}
.click-burst.is-rich .click-wave {
  background: radial-gradient(circle, rgba(255, 252, 240, 0.4) 0%, rgba(246, 214, 150, 0.16) 50%, rgba(246, 214, 150, 0) 74%);
}
.click-burst.is-rich .click-ripple {
  border-color: rgba(226, 190, 110, 0.46);
}
.markly-ink-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
.click-star {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  overflow: visible;
  animation: click-star-fly 680ms cubic-bezier(0.16, 0.72, 0.2, 1) forwards;
}
.click-star path {
  fill: currentColor;
}
.click-dot {
  border-radius: 50%;
}
@keyframes click-ripple-out {
  0% { transform: scale(0.35); opacity: 0.55; }
  100% { transform: scale(var(--ripple-scale, 1)); opacity: 0; }
}
@keyframes click-star-fly {
  0% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx) * 0.16), calc(-50% + var(--dy) * 0.16)) scale(0.55) rotate(0deg);
  }
  32% {
    opacity: var(--star-alpha, 0.38);
    transform: translate(calc(-50% + var(--dx) * 0.5), calc(-50% + var(--dy) * 0.5)) scale(1) rotate(calc(var(--spin) * 0.28));
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.45) rotate(var(--spin));
  }
}
@media (prefers-reduced-motion: reduce) {
  .click-burst-layer { display: none; }
}
</style>
