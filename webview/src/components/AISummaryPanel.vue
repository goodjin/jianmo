<template>
  <div class="ai-summary-panel" role="region" aria-label="AI 摘要">
    <div class="ai-summary-header">
      <span class="ai-summary-title">摘要</span>
      <div class="ai-summary-actions">
        <button type="button" class="ai-summary-btn" :disabled="loading" @click="$emit('summarize-document')">
          全文
        </button>
        <button type="button" class="ai-summary-btn" :disabled="loading" @click="$emit('summarize-section')">
          当前节
        </button>
      </div>
    </div>

    <p class="ai-summary-privacy-hint" role="note">
      出站说明：仅在你点击<strong>全文</strong>/<strong>当前节</strong>并成功发起 AI 请求时传送对应 Markdown；扩展默认关闭 AI（<code>rewrite.enabled=false</code>）、默认 Mock 不向公网写内容。宿主完整说明：<strong>AI: Open Privacy Notice</strong>。
    </p>

    <p v-if="errorMsg" class="ai-summary-hint ai-summary-error" role="status">{{ errorMsg }}</p>
    <p v-else-if="loading" class="ai-summary-hint" role="status">生成中…</p>

    <div v-if="text" class="ai-summary-body">
      <pre class="ai-summary-text">{{ text }}</pre>
      <div class="ai-summary-footer">
        <button type="button" class="ai-summary-btn" @click="$emit('copy')">复制</button>
        <button type="button" class="ai-summary-btn" @click="$emit('insert')">插入</button>
      </div>
    </div>
    <p v-else-if="!loading && !errorMsg" class="ai-summary-empty" role="status">尚未生成摘要</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean;
  text: string;
  errorMsg: string;
}>();

defineEmits<{
  (e: 'summarize-document'): void;
  (e: 'summarize-section'): void;
  (e: 'copy'): void;
  (e: 'insert'): void;
}>();
</script>

<style scoped>
.ai-summary-panel {
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  flex: 0 1 auto;
  max-height: 34%;
  min-height: 84px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
}

.ai-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  gap: 8px;
}

.ai-summary-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--vscode-foreground);
}

.ai-summary-actions {
  display: flex;
  gap: 6px;
}

.ai-summary-btn {
  border: none;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-foreground);
  border-radius: 8px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}

.ai-summary-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.ai-summary-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.ai-summary-privacy-hint {
  margin: 0 12px 6px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--vscode-descriptionForeground);
}

.ai-summary-privacy-hint code {
  font-size: 10px;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.12));
}

.ai-summary-hint {
  margin: 0 12px 6px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--vscode-descriptionForeground);
}

.ai-summary-error {
  color: var(--vscode-errorForeground);
}

.ai-summary-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 8px 8px;
  overflow: hidden;
}

.ai-summary-text {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.35;
}

.ai-summary-footer {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.ai-summary-empty {
  margin: 0 12px 10px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
</style>

