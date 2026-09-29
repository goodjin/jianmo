<template>
  <li
    class="tree-node"
    role="treeitem"
    :aria-expanded="entry.kind === 'dir' ? String(open) : undefined"
  >
    <button
      type="button"
      class="tree-row"
      :class="{
        current: entry.kind === 'file' && entry.path === activePath,
        dir: entry.kind === 'dir',
      }"
      :style="{ paddingLeft: 8 + depth * 14 + 'px' }"
      :title="entry.path"
      :data-path="entry.path"
      @click="onClick"
    >
      <span class="twist" aria-hidden="true">{{ twist }}</span>
      <span class="tree-name">{{ entry.name }}</span>
    </button>
    <ul v-if="entry.kind === 'dir' && open" class="tree-children" role="group">
      <li v-if="busy" class="tree-note">加载中…</li>
      <li v-else-if="err" class="tree-note">{{ err }}</li>
      <li v-else-if="children.length === 0" class="tree-note">没有 Markdown 文档</li>
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { FileTreeEntry } from '../electron/fileTreeModel';
import FileTreeNode from './FileTreeNode.vue';
import { FileTreeKey } from './fileTreeContext';

const props = defineProps<{ entry: FileTreeEntry; depth: number }>();
const ctx = inject(FileTreeKey);

const activePath = computed(() => ctx?.activePath.value ?? '');
const open = computed(() => ctx?.expanded[props.entry.path] === true);
const children = computed(() => ctx?.cache[props.entry.path] ?? []);
const busy = computed(() => ctx?.loading[props.entry.path] === true && ctx?.cache[props.entry.path] === undefined);
const err = computed(() => (open.value ? ctx?.errors[props.entry.path] ?? '' : ''));
const twist = computed(() => (props.entry.kind === 'dir' ? (open.value ? '▾' : '▸') : ''));

function onClick(): void {
  if (!ctx) return;
  if (props.entry.kind === 'dir') ctx.toggleDir(props.entry.path);
  else ctx.openFile(props.entry.path);
}
</script>

<style scoped>
.tree-node { list-style: none; }
.tree-children {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  margin: 0;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-right: 10px;
  box-sizing: border-box;
  border: 0;
  background: transparent;
  color: var(--markly-text, #24292e);
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
}
.tree-row:hover { background: var(--markly-surfaceHover, #eaeef2); }
.tree-row.current {
  background: color-mix(in srgb, var(--markly-primary, #0969da) 16%, transparent);
  font-weight: 600;
}
.tree-row.dir { font-weight: 600; }
.tree-row.dir.current { font-weight: 600; }
.twist {
  flex: 0 0 14px;
  width: 14px;
  text-align: center;
  color: var(--markly-textSecondary, #57606a);
}
.tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-note {
  padding: 4px 12px 6px 28px;
  color: var(--markly-textSecondary, #6a737d);
  font-size: 12px;
  line-height: 1.45;
  list-style: none;
}
</style>
