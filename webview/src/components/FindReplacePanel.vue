<template>
  <div class="find-replace-panel" v-if="visible">
    <div class="panel-header">
      <span class="panel-title">查找和替换</span>
      <button class="close-btn" @click="close">×</button>
    </div>

    <div class="panel-body">
      <div class="input-group">
        <input
          ref="findInputRef"
          v-model="findText"
          type="text"
          class="panel-input"
          placeholder="查找"
          @keydown.enter="findNext"
        />
        <div class="match-info" v-if="matchCount > 0">
          {{ currentMatchIndex + 1 }} / {{ matchCount }}
        </div>
      </div>

      <div class="input-group">
        <input
          v-model="replaceText"
          type="text"
          class="panel-input"
          placeholder="替换"
          @keydown.enter="replace"
        />
      </div>

      <div class="options">
        <label class="option-item">
          <input type="checkbox" v-model="caseSensitive" />
          <span>区分大小写</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="useRegex" />
          <span>正则表达式</span>
        </label>
      </div>

      <div class="actions">
        <button class="action-btn" @click="findNext">查找下一个</button>
        <button class="action-btn" @click="findPrev">查找上一个</button>
        <button class="action-btn primary" @click="replace">替换</button>
        <button class="action-btn primary" @click="replaceAll">全部替换</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  visible: boolean;
  content: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'find', text: string, options: { caseSensitive: boolean; useRegex: boolean; direction: 'next' | 'prev' }): void;
  (e: 'replace', findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }): void;
  (e: 'replaceAll', findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }): void;
}>();

const findInputRef = ref<HTMLInputElement | null>(null);
const findText = ref('');
const replaceText = ref('');
const caseSensitive = ref(false);
const useRegex = ref(false);
const matchCount = ref(0);
const currentMatchIndex = ref(-1);

// Focus input when panel opens
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      findInputRef.value?.focus();
    });
  }
});

function close() {
  emit('close');
}

function findNext() {
  emit('find', findText.value, {
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
    direction: 'next',
  });
}

function findPrev() {
  emit('find', findText.value, {
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
    direction: 'prev',
  });
}

function replace() {
  emit('replace', findText.value, replaceText.value, {
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
  });
}

function replaceAll() {
  emit('replaceAll', findText.value, replaceText.value, {
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
  });
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
}

.options {
  display: flex;
  gap: 16px;
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

.option-item input[type="checkbox"] {
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
