<template>
  <div class="find-replace-panel" v-if="visible">
    <div class="panel-header">
      <span class="panel-title">查找和替换</span>
      <button class="close-btn" type="button" @click="close">×</button>
    </div>

    <div class="panel-body">
      <div class="input-group">
        <input
          ref="findInputRef"
          v-model="findText"
          type="text"
          class="panel-input"
          placeholder="查找"
          @keydown.enter.prevent="emitFindNext"
        />
        <div class="match-info" v-if="matchCount > 0">
          {{ currentMatchIndex + 1 }} / {{ matchCount }}
        </div>
        <div class="match-info no-match" v-else-if="findText.trim()">无匹配</div>
      </div>

      <div class="input-group">
        <input
          v-model="replaceText"
          type="text"
          class="panel-input"
          placeholder="替换"
          @keydown.enter.prevent="emitReplace"
        />
      </div>

      <div class="options">
        <label class="option-item">
          <input v-model="caseSensitive" type="checkbox" />
          <span>区分大小写</span>
        </label>
        <label class="option-item">
          <input v-model="wholeWord" type="checkbox" />
          <span>全字匹配</span>
        </label>
      </div>

      <div class="pattern-modes" role="radiogroup" aria-label="匹配方式">
        <label class="option-item">
          <input v-model="patternMode" type="radio" value="literal" name="patternMode" />
          <span>普通文本</span>
        </label>
        <label class="option-item">
          <input v-model="patternMode" type="radio" value="glob" name="patternMode" />
          <span>通配符 (* ?)</span>
        </label>
        <label class="option-item">
          <input v-model="patternMode" type="radio" value="regex" name="patternMode" />
          <span>正则表达式</span>
        </label>
      </div>

      <div class="actions">
        <button type="button" class="action-btn" @click="emitFindNext">查找下一个</button>
        <button type="button" class="action-btn" @click="emitFindPrev">查找上一个</button>
        <button type="button" class="action-btn primary" @click="emitReplace">替换</button>
        <button type="button" class="action-btn primary" @click="emitReplaceAll">全部替换</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { FindPatternMode } from '@/utils/findPattern';

const props = defineProps<{
  visible: boolean;
  matchCount: number;
  /** 当前高亮匹配，0..matchCount-1，无匹配时为 -1 */
  currentMatchIndex: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'find-next'): void;
  (e: 'find-prev'): void;
  (e: 'replace'): void;
  (e: 'replace-all'): void;
  (
    e: 'query-change',
    payload: {
      findText: string;
      replaceText: string;
      caseSensitive: boolean;
      wholeWord: boolean;
      patternMode: FindPatternMode;
    }
  ): void;
}>();

const findInputRef = ref<HTMLInputElement | null>(null);
const findText = ref('');
const replaceText = ref('');
const caseSensitive = ref(false);
const wholeWord = ref(false);
const patternMode = ref<FindPatternMode>('literal');

function emitQuery() {
  emit('query-change', {
    findText: findText.value,
    replaceText: replaceText.value,
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value,
    patternMode: patternMode.value,
  });
}

watch([findText, replaceText, caseSensitive, wholeWord, patternMode], emitQuery);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => {
        findInputRef.value?.focus();
        emitQuery();
      });
    }
  }
);

function close() {
  emit('close');
}

function emitFindNext() {
  emit('find-next');
}

function emitFindPrev() {
  emit('find-prev');
}

function emitReplace() {
  emit('replace');
}

function emitReplaceAll() {
  emit('replace-all');
}
</script>

<style scoped>
.find-replace-panel {
  position: absolute;
  top: 66px;
  right: 16px;
  width: 320px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.panel-body {
  padding: 16px;
}

.input-group {
  position: relative;
  margin-bottom: 12px;
}

.panel-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-size: 13px;
  box-sizing: border-box;
}

.panel-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.match-info {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  pointer-events: none;
}

.match-info.no-match {
  color: var(--vscode-errorForeground);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.pattern-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.option-item input[type='checkbox'],
.option-item input[type='radio'] {
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.action-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.action-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.action-btn.primary:hover {
  background: var(--vscode-button-hoverBackground);
}
</style>
