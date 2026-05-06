<template>
  <div class="ai-apply-history" role="region" aria-label="AI 应用历史">
    <div class="ai-apply-history-head">
      <span class="ai-apply-history-title">AI 操作</span>
      <button
        v-if="entries.length"
        type="button"
        class="ai-apply-history-clear"
        title="清空本页会话内的历史记录（不影响文档）"
        aria-label="清空 AI 操作历史"
        @click="$emit('clear')"
      >
        清空
      </button>
    </div>

    <p v-if="!entries.length" class="ai-apply-history-empty" role="status">暂无已确认落盘的润色/转表操作</p>
    <ul v-else class="ai-apply-history-list" role="list">
      <li v-for="e in entries" :key="e.id" class="ai-apply-history-li">
        <div class="ai-apply-history-row">
          <span class="ai-apply-history-meta">{{ formatTime(e.ts) }} · {{ kindLabel(e.kind) }} · {{ modeLabel(e) }}</span>
          <span class="ai-apply-history-snippet" :title="e.originalText">{{ ellip(e.originalText) }}</span>
        </div>
        <div class="ai-apply-history-actions">
          <button type="button" class="ai-apply-history-btn" @click="$emit('review', e)">回看</button>
          <button type="button" class="ai-apply-history-btn" @click="$emit('revert', e)">撤销</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { AiApplyHistoryEntry } from '../utils/aiApplyHistory';
import { kindShortLabel } from '../utils/aiApplyHistory';

defineProps<{
  entries: readonly AiApplyHistoryEntry[];
}>();

defineEmits<{
  (e: 'review', entry: AiApplyHistoryEntry): void;
  (e: 'revert', entry: AiApplyHistoryEntry): void;
  (e: 'clear'): void;
}>();

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return `${ts}`;
  }
}

function kindLabel(k: AiApplyHistoryEntry['kind']): string {
  return kindShortLabel(k);
}

function modeLabel(e: AiApplyHistoryEntry): string {
  return e.editorMode === 'rich' ? 'Rich' : '源码';
}

function ellip(s: string, max = 42): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t || '（空）';
  return `${t.slice(0, max)}…`;
}
</script>

<style scoped>
.ai-apply-history {
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  flex: 0 1 auto;
  max-height: 26%;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
}

.ai-apply-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
}

.ai-apply-history-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.ai-apply-history-clear {
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
}

.ai-apply-history-clear:hover {
  color: var(--vscode-foreground);
  background: var(--vscode-toolbar-hoverBackground);
}

.ai-apply-history-empty {
  margin: 0;
  padding: 0 12px 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.ai-apply-history-list {
  list-style: none;
  margin: 0;
  padding: 0 8px 6px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.ai-apply-history-li {
  margin-bottom: 6px;
  padding: 4px 6px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
}

.ai-apply-history-meta {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}

.ai-apply-history-snippet {
  display: block;
  font-size: 11px;
  color: var(--vscode-foreground);
  margin-top: 2px;
  word-break: break-word;
}

.ai-apply-history-actions {
  margin-top: 4px;
  display: flex;
  gap: 6px;
}

.ai-apply-history-btn {
  border: none;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-textLink-foreground, #3794ff);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.ai-apply-history-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
</style>
