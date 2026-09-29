<template>
  <div class="recent-menu" role="menu" aria-label="最近打开">
    <div class="recent-head">
      <span class="recent-title">最近打开</span>
      <button
        type="button"
        class="recent-clear"
        :disabled="items.length === 0"
        title="清空全部历史"
        @click="onClear"
      >全部清理</button>
    </div>

    <div v-if="items.length === 0" class="recent-empty">暂无打开记录</div>
    <ul v-else class="recent-list">
      <li v-for="item in items" :key="item.path" class="recent-item">
        <div class="recent-row">
          <button
            type="button"
            class="recent-main"
            :title="item.path"
            @click="emit('open', item.path)"
          >
            <span class="recent-name">{{ fileNameOf(item.path) }}</span>
            <span class="recent-meta">
              <span class="recent-dir">{{ dirOf(item.path) }}</span>
              <span class="recent-time">{{ formatOpenedAt(item.openedAt) }}</span>
            </span>
          </button>
          <button
            type="button"
            class="recent-icon"
            title="从历史中删除"
            aria-label="从历史中删除"
            @click.stop="onRemove(item.path)"
          >×</button>
          <button
            type="button"
            class="recent-icon recent-arrow"
            :class="{ active: expandedPath === item.path }"
            title="列出同目录 Markdown"
            aria-label="列出同目录 Markdown"
            :aria-expanded="expandedPath === item.path"
            @click.stop="toggleDir(item.path)"
          >→</button>
        </div>

        <div v-if="expandedPath === item.path" class="sibling-panel">
          <div v-if="siblingLoading && siblingFiles.length === 0" class="recent-empty">加载中…</div>
          <div v-else-if="siblingError" class="recent-empty">{{ siblingError }}</div>
          <ul v-else-if="siblingFiles.length" class="sibling-list">
            <li v-for="f in siblingFiles" :key="f.path">
              <button
                type="button"
                class="sibling-btn"
                :class="{ current: f.path === item.path }"
                :title="f.path"
                @click="emit('open', f.path)"
              >{{ f.name }}</button>
            </li>
          </ul>
          <div v-else class="recent-empty">该目录没有 Markdown 文件</div>
          <button
            v-if="siblingHasMore"
            type="button"
            class="recent-more"
            :disabled="siblingLoading"
            @click="loadMore"
          >更多</button>
        </div>
      </li>
    </ul>
    <!-- 固定最后一行：设置入口始终可见，不随列表滚动 -->
    <div class="recent-settings">
      <button
        type="button"
        class="recent-settings-btn"
        title="设置（Cmd/Ctrl+,）"
        @click="emit('settings')"
      >⚙ 设置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { DirMarkdownFile } from '../electron/dirMarkdown';
import { formatOpenedAt, parseRecentFiles, type RecentFileRecord } from '../electron/recentFiles';
import { displayDirFromPath, displayNameFromPath } from './documentMeta';
import { electronApp } from './electronBridge';

const emit = defineEmits<{
  (e: 'open', filePath: string): void;
  (e: 'settings'): void;
}>();

const items = ref<RecentFileRecord[]>([]);
const expandedPath = ref<string | null>(null);
const siblingFiles = ref<DirMarkdownFile[]>([]);
const siblingHasMore = ref(false);
const siblingNextOffset = ref(0);
const siblingLoading = ref(false);
const siblingError = ref('');

function fileNameOf(p: string): string {
  return displayNameFromPath(p).fileName || p;
}

function dirOf(p: string): string {
  return displayDirFromPath(p);
}

function resetSiblings(): void {
  expandedPath.value = null;
  siblingFiles.value = [];
  siblingHasMore.value = false;
  siblingNextOffset.value = 0;
  siblingError.value = '';
}

async function refresh(): Promise<void> {
  const raw = await electronApp()?.listRecentFiles?.();
  items.value = parseRecentFiles(raw);
  if (expandedPath.value && !items.value.some((r) => r.path === expandedPath.value)) {
    resetSiblings();
  }
}

async function onRemove(filePath: string): Promise<void> {
  const raw = await electronApp()?.removeRecentFile?.(filePath);
  items.value = parseRecentFiles(raw ?? (await electronApp()?.listRecentFiles?.()));
  if (expandedPath.value === filePath) resetSiblings();
}

async function onClear(): Promise<void> {
  await electronApp()?.clearRecentFiles?.();
  items.value = [];
  resetSiblings();
}

async function fetchPage(filePath: string, offset: number, append: boolean): Promise<void> {
  siblingLoading.value = true;
  siblingError.value = '';
  try {
    const page = await electronApp()?.listDirMarkdown?.({ filePath, offset });
    if (!page || typeof page !== 'object') {
      siblingError.value = '无法列出该目录';
      return;
    }
    const files = Array.isArray((page as { files?: unknown }).files)
      ? ((page as { files: DirMarkdownFile[] }).files)
      : [];
    const hasMore = Boolean((page as { hasMore?: unknown }).hasMore);
    const nextOffset =
      typeof (page as { nextOffset?: unknown }).nextOffset === 'number'
        ? (page as { nextOffset: number }).nextOffset
        : offset + files.length;
    siblingFiles.value = append ? [...siblingFiles.value, ...files] : files;
    siblingHasMore.value = hasMore;
    siblingNextOffset.value = nextOffset;
  } catch {
    siblingError.value = '无法列出该目录';
  } finally {
    siblingLoading.value = false;
  }
}

async function toggleDir(filePath: string): Promise<void> {
  if (expandedPath.value === filePath) {
    resetSiblings();
    return;
  }
  expandedPath.value = filePath;
  siblingFiles.value = [];
  siblingHasMore.value = false;
  siblingNextOffset.value = 0;
  await fetchPage(filePath, 0, false);
}

async function loadMore(): Promise<void> {
  const p = expandedPath.value;
  if (!p || !siblingHasMore.value || siblingLoading.value) return;
  await fetchPage(p, siblingNextOffset.value, true);
}

onMounted(() => {
  void refresh();
});

defineExpose({ refresh });
</script>

<style>
.recent-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 420px;
  max-width: min(420px, 92vw);
  max-height: min(70vh, 560px);
  overflow: auto;
  background: var(--markly-background, #fff);
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12);
  z-index: 30;
  padding: 8px 0 10px;
  text-align: left;
}
.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px 10px;
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
}
.recent-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--markly-text, #1f2328);
  padding: 4px 0;
}
.recent-clear {
  font-size: 12px;
  line-height: 1.3;
  padding: 6px 10px;
  min-height: 28px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  cursor: pointer;
  color: var(--markly-error, #cf222e);
}
.recent-clear:hover:not(:disabled) { background: #ffebe9; }
.recent-clear:disabled { opacity: 0.45; cursor: default; color: var(--markly-textSecondary, #6a737d); }
.recent-empty {
  padding: 14px 14px;
  font-size: 12px;
  color: var(--markly-textSecondary, #6a737d);
  line-height: 1.5;
}
.recent-settings {
  position: sticky;
  bottom: -10px;
  margin-top: 8px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--markly-border-color, #d0d7de);
  background: var(--markly-background, #fff);
}
.recent-settings-btn {
  width: 100%;
  text-align: left;
  font-size: 12px;
  line-height: 1.3;
  padding: 7px 10px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  cursor: pointer;
}
.recent-settings-btn:hover { background: var(--markly-surface, #f6f8fa); }
.recent-list {
  list-style: none;
  margin: 0;
  padding: 6px 0 0;
}
.recent-item + .recent-item {
  border-top: 1px solid var(--markly-surfaceHover, #f0f2f4);
}
.recent-row {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 4px 8px;
}
.recent-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  border-radius: 6px;
}
.recent-main:hover { background: var(--markly-surface, #f6f8fa); }
.recent-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--markly-text, #1f2328);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--markly-textSecondary, #57606a);
  line-height: 1.4;
  max-width: 100%;
}
.recent-dir {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
.recent-time {
  flex-shrink: 0;
  color: var(--markly-textSecondary, #6a737d);
}
.recent-icon {
  width: 32px;
  min-height: 32px;
  margin: 8px 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--markly-background, #fff);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: var(--markly-textSecondary, #57606a);
}
.recent-icon:hover { background: var(--markly-surface, #f6f8fa); border-color: var(--markly-border-color, #d0d7de); }
.recent-arrow.active {
  background: var(--markly-surfaceHover, #ddf4ff);
  border-color: var(--markly-primary, #54aeff);
  color: var(--markly-primary, #0969da);
}
.sibling-panel {
  margin: 0 10px 8px 12px;
  padding: 8px 8px 10px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 8px;
  background: var(--markly-surface, #fafbfc);
}
.sibling-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}
.sibling-btn {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--markly-text, #24292e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sibling-btn:hover { background: var(--markly-surfaceHover, #eaeef2); }
.sibling-btn.current { font-weight: 600; color: var(--markly-primary, #0969da); }
.recent-more {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 7px 10px;
  min-height: 32px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  cursor: pointer;
  font-size: 12px;
}
.recent-more:hover:not(:disabled) { background: var(--markly-surface, #f6f8fa); }
.recent-more:disabled { opacity: 0.55; cursor: default; }
</style>
