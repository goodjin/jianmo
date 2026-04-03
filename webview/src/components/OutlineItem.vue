<template>
  <div class="outline-item-wrapper">
    <div
      class="outline-item"
      :class="{ active: isActive }"
      :style="{ paddingLeft: (node.level - 1) * 12 + 8 + 'px' }"
      @click="$emit('jump', node)"
    >
      <span
        v-if="node.children && node.children.length > 0"
        class="outline-toggle"
        @click.stop="$emit('toggle', node)"
      >{{ node.collapsed ? '▶' : '▼' }}</span>
      <span class="outline-text">{{ node.text }}</span>
    </div>
    <div v-if="!node.collapsed && node.children && node.children.length > 0" class="outline-children">
      <OutlineItem
        v-for="child in node.children"
        :key="child.from"
        :node="child"
        :active-from="activeFrom"
        @jump="$emit('jump', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HeadingNode } from '@/types';

const props = defineProps<{
  node: HeadingNode;
  activeFrom: number | null;
}>();

defineEmits<{
  (e: 'jump', node: HeadingNode): void;
  (e: 'toggle', node: HeadingNode): void;
}>();

const isActive = computed(() => props.node.from === props.activeFrom);
</script>

<style scoped>
.outline-item-wrapper {
  display: flex;
  flex-direction: column;
}

.outline-item {
  padding: 5px 8px;
  margin: 1px 4px;
  font-size: 13px;
  color: var(--vscode-foreground);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s;
}

.outline-item:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.outline-item.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.outline-toggle {
  font-size: 10px;
  flex-shrink: 0;
}

.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
