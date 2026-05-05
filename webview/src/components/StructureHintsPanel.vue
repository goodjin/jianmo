<template>
  <div class="structure-hints-panel" role="region" aria-label="结构建议">
    <div class="structure-hints-header">
      <span class="structure-hints-title">结构建议</span>
      <span v-if="hasHeadings" class="structure-hints-count" :class="{ 'is-ok': !hints.length }">
        {{ hints.length ? `${hints.length} 项` : '正常' }}
      </span>
    </div>

    <p v-if="!hasHeadings" class="structure-hints-empty" role="status">无 ATX 标题，暂无可分析结构</p>
    <p v-else-if="!hints.length" class="structure-hints-ok" role="status">未发现锚点冲突或层级断层</p>
    <ul v-else class="structure-hints-list" role="list">
      <li v-for="(h, idx) in hints" :key="`${h.kind}-${h.from}-${idx}`" class="structure-hints-li">
        <button
          type="button"
          class="structure-hint-row"
          :title="h.message"
          @click="$emit('jump', h.from, h.headingId)"
        >
          <span class="structure-hint-line">L{{ h.line }}</span>
          <span class="structure-hint-kind" :data-kind="h.kind">{{ kindLabel(h.kind) }}</span>
          <span class="structure-hint-msg">{{ h.message }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  analyzeMarkdownStructureHints,
  type MarkdownStructureHintKind,
} from '../utils/markdownStructureHints';
import { parseHeadings } from '../shared/outline';

const props = defineProps<{
  content: string;
}>();

defineEmits<{
  (e: 'jump', from: number, headingId: string): void;
}>();

const hints = computed(() => analyzeMarkdownStructureHints(props.content ?? ''));
const hasHeadings = computed(() => parseHeadings(props.content ?? '').length > 0);

function kindLabel(k: MarkdownStructureHintKind): string {
  switch (k) {
    case 'duplicate_anchor':
      return '重复';
    case 'heading_level_jump':
      return '断层';
    case 'first_heading_deep':
      return '开篇';
    default:
      return '';
  }
}
</script>

<style scoped>
.structure-hints-panel {
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  flex: 0 1 auto;
  max-height: 30%;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
}

.structure-hints-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  gap: 8px;
}

.structure-hints-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.structure-hints-count {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.structure-hints-count.is-ok {
  color: var(--vscode-testing-iconPassed, #3fb950);
}

.structure-hints-empty,
.structure-hints-ok {
  margin: 0;
  padding: 4px 12px 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.structure-hints-ok {
  color: var(--vscode-testing-iconPassed, #3fb950);
}

.structure-hints-list {
  list-style: none;
  margin: 0;
  padding: 0 4px 6px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.structure-hints-li {
  margin: 0;
}

.structure-hint-row {
  width: 100%;
  display: grid;
  grid-template-columns: 36px 36px minmax(0, 1fr);
  gap: 6px;
  align-items: start;
  text-align: left;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 11px;
  line-height: 1.35;
}

.structure-hint-row:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.structure-hint-line {
  font-variant-numeric: tabular-nums;
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
}

.structure-hint-kind {
  font-weight: 600;
  white-space: nowrap;
}

.structure-hint-kind[data-kind='duplicate_anchor'] {
  color: var(--vscode-editorWarning-foreground, #cca700);
}

.structure-hint-kind[data-kind='heading_level_jump'],
.structure-hint-kind[data-kind='first_heading_deep'] {
  color: var(--vscode-textLink-foreground, #3794ff);
}

.structure-hint-msg {
  min-width: 0;
  word-break: break-word;
}
</style>
