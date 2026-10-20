<template>
  <div class="tab-bar">
    <div class="tab-scroller">
      <button
        v-if="canScrollLeft"
        class="tab-scroll tab-scroll-left"
        type="button"
        title="向左看标签"
        aria-label="向左看标签"
        @click="scrollTabs(-1)"
      >‹</button>
      <div
        ref="stripRef"
        class="tab-strip"
        role="tablist"
        :style="stripStyle"
        @scroll="measure"
      >
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === activeId }"
          role="tab"
          :aria-selected="tab.id === activeId"
          :title="tab.filePath || tab.title"
          @click="emit('activate', tab.id)"
          @auxclick.middle.prevent="emit('close', tab.id)"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <span v-if="tab.dirty" class="tab-dirty" title="未保存" aria-label="未保存"></span>
          <button
            class="tab-close"
            type="button"
            title="关闭标签页"
            :aria-label="`关闭 ${tab.title}`"
            @click.stop="emit('close', tab.id)"
          >×</button>
        </div>
        <button
          class="tab-new"
          type="button"
          title="新建标签页（Cmd/Ctrl+T）"
          aria-label="新建标签页"
          @click="emit('new')"
        >+</button>
      </div>
      <button
        v-if="canScrollRight"
        class="tab-scroll tab-scroll-right"
        type="button"
        title="向右看标签"
        aria-label="向右看标签"
        @click="scrollTabs(1)"
      >›</button>
    </div>
    <div class="tab-tools">
      <slot name="tools" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TabSummary } from './electronBridge';
import { TAB_MAX_WIDTH_PX, TAB_MIN_WIDTH_PX, tabScrollEdges } from './tabStrip';

const props = defineProps<{ tabs: TabSummary[]; activeId: string }>();

const emit = defineEmits<{
  (e: 'activate', id: string): void;
  (e: 'close', id: string): void;
  (e: 'new'): void;
}>();

const stripStyle = {
  '--tab-min': `${TAB_MIN_WIDTH_PX}px`,
  '--tab-max': `${TAB_MAX_WIDTH_PX}px`,
};

const stripRef = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function measure(): void {
  const el = stripRef.value;
  if (!el) {
    canScrollLeft.value = false;
    canScrollRight.value = false;
    return;
  }
  const edges = tabScrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth);
  canScrollLeft.value = edges.left;
  canScrollRight.value = edges.right;
}

function scrollTabs(dir: -1 | 1): void {
  const el = stripRef.value;
  if (!el) return;
  const step = Math.max(TAB_MIN_WIDTH_PX, Math.round(el.clientWidth * 0.6));
  el.scrollBy({ left: dir * step, behavior: 'smooth' });
  measure();
}

function revealActive(): void {
  const strip = stripRef.value;
  const active = strip?.querySelector('.tab.active');
  if (active && typeof active.scrollIntoView === 'function') {
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  measure();
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  const el = stripRef.value;
  if (el && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure());
    observer.observe(el);
  }
  void nextTick(revealActive);
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});

watch(
  () => [props.tabs.length, props.activeId] as const,
  () => {
    void nextTick(revealActive);
  }
);
</script>

<style scoped>
.tab-bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 0 8px 0 0;
  min-height: 40px;
  min-width: 0;
  box-sizing: border-box;
  background: var(--markly-surface, #f6f8fa);
}
.tab-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--markly-border-color, #d0d7de);
  z-index: 0;
}
.tab-scroller {
  position: relative;
  display: flex;
  align-items: flex-end;
  align-self: stretch;
  flex: 1;
  min-width: 0;
}
.tab-tools {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  align-self: center;
  gap: 4px;
  z-index: 1;
}
.tab-strip {
  display: flex;
  align-items: flex-end;
  align-self: stretch;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  z-index: 1;
}
.tab-strip::-webkit-scrollbar { display: none; }
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 180px;
  min-width: var(--tab-min, 120px);
  max-width: var(--tab-max, 220px);
  padding: 0 6px 0 10px;
  margin-top: 6px;
  height: calc(100% - 6px);
  box-sizing: border-box;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: var(--app-radius-sm) var(--app-radius-sm) 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--markly-textSecondary, #57606a);
  cursor: pointer;
  user-select: none;
  position: relative;
  z-index: 1;
}
.tab:hover { background: var(--markly-surfaceHover, #eaeef2); }
.tab.active {
  height: 100%;
  margin-top: 0;
  background: var(--markly-background, #fff);
  border-color: var(--markly-border-color, #d0d7de);
  color: var(--markly-text, #1f2328);
  font-weight: 600;
  z-index: 2;
}
.tab-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-dirty {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.tab-close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-xs);
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.55;
}
.tab-close:hover {
  background: var(--markly-border-color, #d0d7de);
  opacity: 1;
}
.tab-new {
  flex: 0 0 auto;
  align-self: center;
  width: 26px;
  height: 26px;
  margin: 0 2px;
  padding: 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-sm);
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.tab-new:hover { background: var(--markly-surfaceHover, #eaeef2); }
.tab-scroll {
  position: absolute;
  top: 7px;
  z-index: 3;
  width: 22px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-xxs);
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.tab-scroll:hover { background: var(--markly-surfaceHover, #eaeef2); }
.tab-scroll-left { left: 0; }
.tab-scroll-right { right: 0; }
</style>
