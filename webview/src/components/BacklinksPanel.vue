<template>
  <div class="backlinks-panel" role="region" aria-label="反向链接">
    <div class="backlinks-header">
      <span class="backlinks-title">反向链接</span>
      <button
        type="button"
        class="backlinks-refresh"
        :disabled="loading"
        title="重新扫描工作区"
        aria-label="重新扫描反向链接"
        @click="$emit('refresh')"
      >
        {{ loading ? '…' : '↻' }}
      </button>
    </div>
    <p v-if="errorMsg" class="backlinks-hint backlinks-error" role="status">{{ errorMsg }}</p>
    <p v-else-if="truncatedHint" class="backlinks-hint" role="status">{{ truncatedHint }}</p>
    <ul v-if="!errorMsg && items.length" class="backlinks-list">
      <li v-for="(it, idx) in items" :key="it.uri + idx">
        <button type="button" class="backlinks-item" :title="it.workspaceRelativePath" @click="$emit('open', it.uri)">
          {{ it.workspaceRelativePath }}
        </button>
      </li>
    </ul>
    <p v-else-if="loading" class="backlinks-empty" role="status">扫描中…</p>
    <p v-else-if="!errorMsg" class="backlinks-empty" role="status">暂无其它文档链入本篇</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface BacklinkRow {
  uri: string;
  workspaceRelativePath: string;
}

const props = defineProps<{
  items: BacklinkRow[];
  loading: boolean;
  /** 已向用户本地化后的错误或提示 */
  errorMsg: string;
  truncated: boolean;
}>();

defineEmits<{
  (e: 'refresh'): void;
  (e: 'open', uri: string): void;
}>();

const truncatedHint = computed(() =>
  props.truncated ? '已扫描的文件数较多，结果为截断快照；可把仓库拆区或稍后重试。' : ''
);
</script>

<style scoped>
.backlinks-panel {
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  flex: 0 1 auto;
  max-height: 38%;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
}

.backlinks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  gap: 8px;
}

.backlinks-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.backlinks-refresh {
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 14px;
  line-height: 1;
  border-radius: var(--markly-radius-sm);
}

.backlinks-refresh:hover:not(:disabled) {
  color: var(--vscode-foreground);
  background: var(--vscode-toolbar-hoverBackground);
}

.backlinks-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}

.backlinks-hint {
  margin: 0 12px 6px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vscode-descriptionForeground);
}

.backlinks-error {
  color: var(--vscode-errorForeground);
}

.backlinks-empty {
  margin: 0 12px 10px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.backlinks-list {
  list-style: none;
  margin: 0;
  padding: 0 8px 8px;
  overflow-y: auto;
}

.backlinks-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 8px;
  margin: 2px 0;
  border: 1px solid transparent;
  border-radius: var(--markly-radius-sm);
  background: transparent;
  color: var(--vscode-textLink-foreground, var(--vscode-foreground));
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.backlinks-item:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
</style>
