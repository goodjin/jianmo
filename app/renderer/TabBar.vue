<template>
  <div class="tab-bar">
    <div class="tab-strip" role="tablist">
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
        <button
          class="tab-close"
          type="button"
          title="关闭标签页"
          :aria-label="`关闭 ${tab.title}`"
          @click.stop="emit('close', tab.id)"
        >×</button>
      </div>
    </div>
    <!-- 右槽：新建标签页按钮前的小图标（复制、导出、设置） -->
    <slot name="pre-new" />
    <button
      class="tab-new"
      type="button"
      title="新建标签页（Cmd/Ctrl+T）"
      aria-label="新建标签页"
      @click="emit('new')"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import type { TabSummary } from './electronBridge';

defineProps<{ tabs: TabSummary[]; activeId: string }>();

const emit = defineEmits<{
  (e: 'activate', id: string): void;
  (e: 'close', id: string): void;
  (e: 'new'): void;
}>();
</script>

<style scoped>
.tab-bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 0 8px 0 0;
  min-width: 0;
  max-width: 100%;
  min-height: 40px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--markly-surface, #f6f8fa);
}
/* 底部分界线单独画，活动标签用白底盖住自己脚下的那一段，和正文连成一片 */
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
/* 标签自身横向滚动，"+" 不会被挤出视野 */
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
  flex: 0 1 180px;
  min-width: 90px;
  max-width: 220px;
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
  flex-shrink: 0;
  align-self: center;
  width: 26px;
  height: 26px;
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
</style>
