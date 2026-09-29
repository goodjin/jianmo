<template>
  <aside class="file-tree" :class="{ collapsed }">
    <div class="file-head">
      <span v-if="!collapsed" class="file-head-title">文件</span>
      <span v-if="!collapsed" class="file-head-actions">
        <button
          type="button"
          class="file-icon-btn"
          title="刷新目录树"
          :disabled="!root"
          @click="onRefresh"
        >刷新</button>
      </span>
      <button
        class="file-toggle"
        type="button"
        :title="collapsed ? '展开文件' : '收起文件'"
        :aria-label="collapsed ? '展开文件' : '收起文件'"
        :aria-expanded="!collapsed"
        @click="emit('toggle')"
      >{{ collapsed ? '›' : '‹' }}</button>
    </div>

    <template v-if="!collapsed">
      <div v-if="root" class="file-root" :title="root">{{ rootName }}</div>
      <div v-if="rootBusy" class="file-empty">加载中…</div>
      <div v-else-if="rootErr" class="file-empty">{{ rootErr }}</div>
      <div v-else class="tree-scroll">
        <ul class="tree" role="tree" aria-label="文件">
          <FileTreeNode
            v-for="entry in rootEntries"
            :key="entry.path"
            :entry="entry"
            :depth="0"
          />
          <li v-if="rootEntries.length === 0" class="tree-note">没有 Markdown 文档</li>
        </ul>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, reactive, ref, toRef, watch } from 'vue';
import {
  ancestorDirs,
  filesystemRootOf,
  parentDir,
  parseFileTreeResult,
  isPathUnderRoot,
} from '../electron/fileTreeModel';
import type { FileTreeEntry, FileTreeListResult } from '../electron/fileTreeModel';
import { displayNameFromPath } from './documentMeta';
import { electronApp } from './electronBridge';
import FileTreeNode from './FileTreeNode.vue';
import { FileTreeKey, type FileTreeContext } from './fileTreeContext';

const props = defineProps<{ collapsed: boolean; activePath: string }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();

const root = ref('');
const expanded = reactive<Record<string, boolean>>({});
const cache = reactive<Record<string, FileTreeEntry[] | undefined>>({});
const loading = reactive<Record<string, boolean>>({});
const errors = reactive<Record<string, string>>({});

const rootName = computed(() => displayNameFromPath(root.value).fileName || root.value);
const rootEntries = computed(() => (root.value ? cache[root.value] ?? [] : []));
const rootErr = computed(() => (root.value ? errors[root.value] ?? '' : ''));
const rootBusy = computed(
  () => !!root.value && loading[root.value] === true && cache[root.value] === undefined
);

function clearTree(): void {
  for (const key of Object.keys(expanded)) delete expanded[key];
  for (const key of Object.keys(cache)) delete cache[key];
  for (const key of Object.keys(loading)) delete loading[key];
  for (const key of Object.keys(errors)) delete errors[key];
}

async function fetchDir(dir: string): Promise<FileTreeListResult> {
  loading[dir] = true;
  try {
    const page = parseFileTreeResult(await electronApp()?.listFileTree?.(dir));
    cache[dir] = page.entries;
    errors[dir] = page.error;
    return page;
  } catch {
    const page = { dir, entries: [], error: '无法读取该文件夹' };
    cache[dir] = [];
    errors[dir] = page.error;
    return page;
  } finally {
    loading[dir] = false;
  }
}

async function reveal(filePath: string): Promise<void> {
  if (!root.value || !filePath || !isPathUnderRoot(root.value, filePath)) return;
  for (const dir of ancestorDirs(root.value, filePath)) {
    expanded[dir] = true;
    if (cache[dir] === undefined) await fetchDir(dir);
  }
  await nextTick();
  try {
    document.querySelector('.file-tree .tree-row.current')?.scrollIntoView({ block: 'nearest' });
  } catch {
    /* jsdom 没有完整的 scrollIntoView */
  }
}

async function applyRoot(next: string): Promise<void> {
  const changed = next !== root.value;
  root.value = next;
  if (!next) {
    clearTree();
    return;
  }
  if (changed) clearTree();
  await fetchDir(next);
  await reveal(props.activePath);
}

/**
 * 树根 = 当前文档所属的文件系统根（POSIX `/`、Windows 盘符根），完整文件夹树从根目录铺开。
 * 打开文档时自动跟随：只展开当前文档所在目录及其父目录，其余文件夹保持收起、可手动展开。
 */
async function syncRoot(): Promise<void> {
  const next = filesystemRootOf(props.activePath) || root.value || '/';
  if (next !== root.value) {
    await applyRoot(next);
    return;
  }
  await reveal(props.activePath);
}

async function onRefresh(): Promise<void> {
  if (!root.value) return;
  const openDirs = Object.keys(expanded).filter((key) => expanded[key]);
  await fetchDir(root.value);
  for (const dir of openDirs) await fetchDir(dir);
}

function toggleDir(dir: string): void {
  if (expanded[dir]) {
    expanded[dir] = false;
    return;
  }
  expanded[dir] = true;
  if (cache[dir] === undefined) void fetchDir(dir);
}

async function openFile(file: string): Promise<void> {
  const opened = await electronApp()?.openPath?.(file);
  if (opened) return;
  const parent = parentDir(file);
  if (parent) await fetchDir(parent);
}

const ctx: FileTreeContext = {
  activePath: toRef(props, 'activePath'),
  expanded,
  cache,
  loading,
  errors,
  toggleDir,
  openFile: (file) => void openFile(file),
};
provide(FileTreeKey, ctx);

watch(
  () => props.activePath,
  () => {
    void syncRoot();
  }
);

onMounted(() => {
  void syncRoot();
});
</script>

<style scoped>
.file-tree {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--markly-border-color, #d0d7de);
  background: var(--markly-surface, #fafbfc);
  color: var(--markly-text, #24292e);
}
.file-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 8px 12px;
  min-height: 40px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
  flex-shrink: 0;
}
.file-head-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
.file-head-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.file-icon-btn,
.file-toggle {
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.3;
  height: 28px;
  padding: 0 8px;
}
.file-icon-btn:hover,
.file-toggle:hover {
  background: var(--markly-surface, #f6f8fa);
}
.file-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.file-tree.collapsed .file-head {
  flex-direction: column;
  justify-content: flex-start;
  padding: 8px 6px;
  border-bottom: 0;
  min-height: 0;
  height: 100%;
}
.file-root {
  padding: 8px 12px 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--markly-textSecondary, #57606a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.file-empty {
  padding: 16px 12px;
  color: var(--markly-textSecondary, #57606a);
  font-size: 12px;
  line-height: 1.5;
}
.tree-scroll {
  overflow: auto;
  min-height: 0;
  flex: 1;
  padding: 6px 0 12px;
}
.tree {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tree-note {
  padding: 8px 12px;
  color: var(--markly-textSecondary, #6a737d);
  font-size: 12px;
  line-height: 1.45;
  list-style: none;
}
</style>
