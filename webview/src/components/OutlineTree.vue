<template>
  <div class="outline-tree">
    <OutlineItem
      v-for="node in tree"
      :key="node.from"
      :node="node"
      :active-from="activeFrom"
      @jump="$emit('jump', $event)"
      @toggle="handleToggle"
    />
    <div v-if="tree.length === 0" class="outline-empty">
      暂无标题
    </div>
  </div>
</template>

<script setup lang="ts">
import OutlineItem from './OutlineItem.vue';
import type { HeadingNode } from '@/types';

defineProps<{
  tree: HeadingNode[];
  activeFrom: number | null;
}>();

const emit = defineEmits<{
  (e: 'jump', node: HeadingNode): void;
}>();

function handleToggle(node: HeadingNode): void {
  node.collapsed = !node.collapsed;
}
</script>

<style scoped>
.outline-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.outline-empty {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
}
</style>
