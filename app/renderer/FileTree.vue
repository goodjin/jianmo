<template>
  <aside class="file-tree" :class="{ collapsed }">
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
          <li v-if="rootEntries.length === 0" class="tree-note">没有可打开的文档</li>
        </ul>
      </div>
    </template>
    <Teleport to="body">
      <div
        v-if="menu"
        class="tree-menu"
        role="menu"
        aria-label="文件操作"
        :style="{ top: menu.y + 'px', left: menu.x + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <template v-if="!menu.confirming">
          <button type="button" role="menuitem" @click="beginRename">重命名</button>
          <button type="button" role="menuitem" @click="revealInFinder">在 Finder 打开</button>
          <button type="button" role="menuitem" @click="copyFullPath">复制全路径</button>
          <button type="button" role="menuitem" @click="copyFileName">复制文件名</button>
          <button type="button" role="menuitem" class="tree-menu-danger" @click="askTrash">删除</button>
        </template>
        <template v-else>
          <p class="tree-menu-confirm">要把「{{ menu.name }}」移到废纸篓吗？</p>
          <p v-if="menu.error" class="tree-menu-error">{{ menu.error }}</p>
          <button
            type="button"
            role="menuitem"
            class="tree-menu-danger"
            :disabled="menu.busy"
            @click="confirmTrash"
          >{{ menu.busy ? '正在移到废纸篓…' : '移到废纸篓' }}</button>
          <button type="button" role="menuitem" :disabled="menu.busy" @click="closeMenu">取消</button>
        </template>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, reactive, ref, toRef, watch } from 'vue';
import {
  ancestorDirs,
  canGoToParent,
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
import { parseRenameResult, planRename } from '../electron/fileRename';
import { parseTrashResult } from '../electron/trashFile';

const props = defineProps<{ collapsed: boolean; activePath: string }>();
const emit = defineEmits<{
  (e: 'chrome', state: { canGoUp: boolean; hasRoot: boolean }): void;
}>();

const root = ref('');
const expanded = reactive<Record<string, boolean>>({});
const cache = reactive<Record<string, FileTreeEntry[] | undefined>>({});
const loading = reactive<Record<string, boolean>>({});
const errors = reactive<Record<string, string>>({});

const rootName = computed(() => displayNameFromPath(root.value).fileName || root.value);
const canGoUp = computed(() => canGoToParent(root.value));
const rootEntries = computed(() => (root.value ? cache[root.value] ?? [] : []));
const rootErr = computed(() => (root.value ? errors[root.value] ?? '' : ''));
const rootBusy = computed(
  () => !!root.value && loading[root.value] === true && cache[root.value] === undefined
);

interface FileMenuState {
  path: string;
  name: string;
  x: number;
  y: number;
  confirming: boolean;
  busy: boolean;
  error: string;
}

const menu = ref<FileMenuState | null>(null);
const renamingPath = ref('');
const renameDraft = ref('');
const renameError = ref('');
let ignoreRenameBlur = false;
let renameBusy = false;

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

/** 打开的文档如果在当前目录下面，就展开到它；否则把树根挪到文档所在目录。 */
async function followActiveFile(): Promise<void> {
  const file = props.activePath;
  if (!file) return;
  if (root.value && isPathUnderRoot(root.value, file)) {
    await reveal(file);
    return;
  }
  const next = parentDir(file) || filesystemRootOf(file);
  if (!next) return;
  await applyRoot(next);
}

async function goUp(): Promise<void> {
  const parent = parentDir(root.value);
  if (!canGoToParent(root.value) || !parent) return;
  const committed = await electronApp()?.setFileTreeRoot?.(parent);
  const next = typeof committed === 'string' && committed.trim() ? committed.trim() : parent;
  await applyRoot(next);
}

/**
 * 第一次打开停在主进程给的目录（默认是用户主目录）。
 * 当前文档不在这个目录里时，改到文档所在目录，方便在树里看到它。
 */
async function loadInitialRoot(): Promise<void> {
  const fromHost = await electronApp()?.fileTreeRoot?.();
  const hostRoot = typeof fromHost === 'string' ? fromHost.trim() : '';
  const file = props.activePath;
  let initial = hostRoot;
  if (file && initial && !isPathUnderRoot(initial, file)) {
    initial = parentDir(file) || initial;
  }
  if (!initial) initial = parentDir(file) || filesystemRootOf(file);
  if (initial) await applyRoot(initial);
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

function closeMenu(): void {
  menu.value = null;
}

function placeMenu(x: number, y: number, height: number): { x: number; y: number } {
  const pad = 8;
  const width = 220;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    x: Math.min(Math.max(pad, x), maxX),
    y: Math.min(Math.max(pad, y), maxY),
  };
}

function openFileMenu(entry: FileTreeEntry, x: number, y: number): void {
  if (entry.kind !== 'file') return;
  cancelRename();
  const placed = placeMenu(x, y, 188);
  menu.value = {
    path: entry.path,
    name: entry.name,
    confirming: false,
    busy: false,
    error: '',
    ...placed,
  };
}

function askTrash(): void {
  const current = menu.value;
  if (!current || current.confirming) return;
  const placed = placeMenu(current.x, current.y, 132);
  menu.value = { ...current, confirming: true, busy: false, error: '', ...placed };
}

async function confirmTrash(): Promise<void> {
  const current = menu.value;
  if (!current?.confirming || current.busy) return;
  menu.value = { ...current, busy: true, error: '' };
  const result = parseTrashResult(await electronApp()?.trashFile?.(current.path));
  if (!menu.value || menu.value.path !== current.path || !menu.value.confirming) return;
  if (!result.ok) {
    menu.value = { ...menu.value, busy: false, error: result.error };
    return;
  }
  closeMenu();
  const parent = parentDir(current.path);
  if (parent) await fetchDir(parent);
}

function beginRename(): void {
  const current = menu.value;
  if (!current) return;
  closeMenu();
  ignoreRenameBlur = false;
  renamingPath.value = current.path;
  renameDraft.value = current.name;
  renameError.value = '';
}

function cancelRename(): void {
  if (!renamingPath.value) return;
  ignoreRenameBlur = true;
  renamingPath.value = '';
  renameError.value = '';
  queueMicrotask(() => {
    ignoreRenameBlur = false;
  });
}

async function focusRenameInput(): Promise<void> {
  await nextTick();
  const input = document.querySelector<HTMLInputElement>('.file-tree .tree-rename');
  input?.focus();
  input?.select();
}

async function commitRename(): Promise<void> {
  if (ignoreRenameBlur || renameBusy || !renamingPath.value) return;
  const from = renamingPath.value;
  const name = renameDraft.value;
  const plan = planRename(from, name, () => false);
  if (!plan.ok) {
    renameError.value = plan.error;
    await focusRenameInput();
    return;
  }
  if (plan.unchanged) {
    cancelRename();
    return;
  }
  renameBusy = true;
  try {
    const result = parseRenameResult(await electronApp()?.renameFile?.(from, name));
    if (!renamingPath.value || renamingPath.value !== from) return;
    if (!result.ok) {
      renameError.value = result.error;
      await focusRenameInput();
      return;
    }
    renamingPath.value = '';
    renameError.value = '';
    const parent = parentDir(from);
    if (parent) await fetchDir(parent);
  } finally {
    renameBusy = false;
  }
}

async function copyMenuText(text: string): Promise<void> {
  const current = text;
  closeMenu();
  if (!current) return;
  await electronApp()?.copyExactText?.(current);
}

function copyFullPath(): void {
  void copyMenuText(menu.value?.path ?? '');
}

function copyFileName(): void {
  void copyMenuText(displayNameFromPath(menu.value?.path).fileName);
}

function revealInFinder(): void {
  const target = menu.value?.path ?? '';
  closeMenu();
  if (!target) return;
  void electronApp()?.revealInFolder?.(target);
}

function onDocPointerDown(ev: MouseEvent): void {
  const target = ev.target;
  if (target instanceof Node && document.querySelector('.tree-menu')?.contains(target)) return;
  closeMenu();
}

function onDocKeyDown(ev: KeyboardEvent): void {
  if (ev.key !== 'Escape') return;
  closeMenu();
  cancelRename();
}

const ctx: FileTreeContext = {
  activePath: toRef(props, 'activePath'),
  expanded,
  cache,
  loading,
  errors,
  toggleDir,
  openFile: (file) => void openFile(file),
  renamingPath,
  renameDraft,
  renameError,
  openFileMenu,
  setRenameDraft: (value) => {
    renameDraft.value = value;
  },
  commitRename: () => void commitRename(),
  cancelRename,
};
provide(FileTreeKey, ctx);

let treeReady = false;

watch(
  [canGoUp, root],
  () => {
    emit('chrome', { canGoUp: canGoUp.value, hasRoot: !!root.value });
  },
  { immediate: true }
);

defineExpose({ goUp, refresh: onRefresh });

watch(
  () => props.activePath,
  () => {
    if (!treeReady) return;
    void followActiveFile();
  }
);

watch(
  () => props.collapsed,
  (collapsed) => {
    if (collapsed) closeMenu();
  }
);

watch(renamingPath, (path) => {
  if (path) void focusRenameInput();
});

onMounted(() => {
  document.addEventListener('mousedown', onDocPointerDown);
  document.addEventListener('keydown', onDocKeyDown);
  void loadInitialRoot().finally(() => {
    treeReady = true;
  });
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocPointerDown);
  document.removeEventListener('keydown', onDocKeyDown);
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
  /* 只在文件树里滚。名字超出用省略号，不要再出一条横条和正文连成一条。 */
  overflow-x: hidden;
  overflow-y: auto;
  min-width: 0;
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
.tree-menu {
  position: fixed;
  z-index: 80;
  min-width: 148px;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-md);
  background: var(--markly-background, #fff);
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.16);
}
.tree-menu button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--markly-text, #24292e);
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.tree-menu button:hover {
  background: var(--markly-surfaceHover, #eaeef2);
}
.tree-menu button:disabled {
  opacity: 0.55;
  cursor: default;
}
.tree-menu-danger {
  color: var(--markly-error, #cf222e);
}
.tree-menu-confirm,
.tree-menu-error {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.tree-menu-error {
  color: var(--markly-error, #cf222e);
  padding-top: 0;
}
</style>
