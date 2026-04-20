<template>
  <div class="find-replace-panel" v-if="visible">
    <div class="panel-header">
      <span class="panel-title">查找和替换</span>
      <button class="close-btn" type="button" @click="close">×</button>
    </div>

    <div class="panel-body">
      <div class="row">
        <div class="field">
          <input
            ref="findInputRef"
            v-model="findText"
            type="text"
            class="panel-input"
            placeholder="查找"
            @keydown.enter.prevent="emitFindNext"
          />
          <div class="match-info" v-if="matchCount > 0">
            {{ matchPositionLabel }} / {{ matchCount }}{{ matchCountTruncated ? '+' : '' }}
          </div>
          <div class="match-info no-match" v-else-if="findText.trim()">无匹配</div>
        </div>

        <div class="icon-actions" role="group" aria-label="查找操作">
          <button class="icon-btn" type="button" title="查找上一个" aria-label="查找上一个" @click="emitFindPrev">
            ↑
          </button>
          <button class="icon-btn" type="button" title="查找下一个" aria-label="查找下一个" @click="emitFindNext">
            ↓
          </button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <input
            v-model="replaceText"
            type="text"
            class="panel-input"
            placeholder="替换"
            @keydown.enter.prevent="emitReplace"
          />
        </div>

        <div class="icon-actions" role="group" aria-label="替换操作">
          <button class="icon-btn" type="button" title="替换" aria-label="替换" @click="emitReplace">⤶</button>
          <button class="icon-btn primary" type="button" title="全部替换" aria-label="全部替换" @click="emitReplaceAll">
            ⤶⤶
          </button>
        </div>
      </div>

      <div class="toggles" role="group" aria-label="查找选项">
        <button
          class="toggle-btn"
          type="button"
          :class="{ active: caseSensitive }"
          title="区分大小写"
          aria-label="区分大小写"
          @click="caseSensitive = !caseSensitive"
        >
          Aa
        </button>
        <button
          class="toggle-btn"
          type="button"
          :class="{ active: wholeWord }"
          title="全字匹配"
          aria-label="全字匹配"
          @click="wholeWord = !wholeWord"
        >
          W
        </button>

        <div class="toggle-divider" aria-hidden="true"></div>

        <button
          class="toggle-btn"
          type="button"
          :class="{ active: patternMode === 'literal' }"
          title="普通文本"
          aria-label="普通文本"
          @click="patternMode = 'literal'"
        >
          ab
        </button>
        <button
          class="toggle-btn"
          type="button"
          :class="{ active: patternMode === 'glob' }"
          title="通配符 (* ?)"
          aria-label="通配符 (* ?)"
          @click="patternMode = 'glob'"
        >
          *?
        </button>
        <button
          class="toggle-btn"
          type="button"
          :class="{ active: patternMode === 'regex' }"
          title="正则表达式"
          aria-label="正则表达式"
          @click="patternMode = 'regex'"
        >
          .*
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import type { FindPatternMode } from '@/utils/findPattern';

const props = defineProps<{
  visible: boolean;
  matchCount: number;
  /** 匹配数已达上限（仅统计前 N 条），展示为「n / N+」 */
  matchCountTruncated?: boolean;
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

const matchPositionLabel = computed(() => {
  if (props.currentMatchIndex < 0) return '—';
  return String(props.currentMatchIndex + 1);
});

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
  top: 42px;
  right: 10px;
  width: 360px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border: var(--markly-border);
  border-radius: var(--markly-radius-md);
  box-shadow: var(--markly-shadow-elev);
  z-index: 100;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
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
  border-radius: var(--markly-radius-sm);
}

.close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.panel-body {
  padding: 12px;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.field {
  position: relative;
  flex: 1;
}

.panel-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border, var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25)));
  border-radius: var(--markly-radius-sm);
  background: var(--vscode-input-background, var(--vscode-editor-background));
  color: var(--vscode-input-foreground, var(--vscode-foreground));
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

.icon-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--markly-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-contrastBorder, transparent);
}

.icon-btn:active {
  background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
}

.icon-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.toggles {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.toggle-btn {
  height: 24px;
  min-width: 28px;
  padding: 0 6px;
  border-radius: var(--markly-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.toggle-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-contrastBorder, transparent);
}

.toggle-btn.active {
  background: var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground));
  border-color: var(--vscode-focusBorder, var(--vscode-contrastBorder, transparent));
}

.toggle-divider {
  width: 1px;
  height: 16px;
  background: var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  margin: 0 2px;
}
</style>
