<template>
  <div class="md-editor-app" :class="{ 'theme-dark': isDark }">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      @format="handleFormat"
      @insert="handleInsert"
      @toggle-mode="toggleMode"
    />
    <div class="editor-container">
      <!-- 源码模式 -->
      <div v-if="currentMode === 'source'" class="source-editor">
        <textarea
          ref="textareaRef"
          v-model="sourceContent"
          class="source-textarea"
          @input="handleSourceChange"
        ></textarea>
      </div>

      <!-- 预览模式 -->
      <MilkdownEditor
        v-else-if="currentMode === 'preview' && editorReady"
        ref="editorRef"
        :content="content"
        :config="config"
        @change="handleChange"
        @image-click="handleImageClick"
        @image-context-menu="handleImageContextMenu"
      />

      <div v-if="!editorReady" class="loading">
        <span>Loading editor...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import MilkdownEditor from './components/MilkdownEditor.vue';
import Toolbar from './components/Toolbar.vue';
import type { ExtensionConfig, ExtensionMessage, EditorMode } from '../../src/types';

const vscode = (window as any).vscode;

// State
const content = ref('');
const sourceContent = ref('');
const config = ref<ExtensionConfig | null>(null);
const editorReady = ref(false);
const currentMode = ref<EditorMode>('preview');
const editorRef = ref<InstanceType<typeof MilkdownEditor> | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Theme
const isDark = computed(() => {
  if (!config.value) return false;
  if (config.value.editor.theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return config.value.editor.theme === 'dark';
});

// Message handling
function handleMessage(event: MessageEvent) {
  const message: ExtensionMessage = event.data;

  switch (message.type) {
    case 'INIT':
      content.value = message.payload.content;
      sourceContent.value = message.payload.content;
      config.value = message.payload.config;
      editorReady.value = true;
      break;

    case 'CONTENT_UPDATE':
      content.value = message.payload.content;
      sourceContent.value = message.payload.content;
      break;

    case 'CONFIG_CHANGE':
      config.value = { ...config.value, ...message.payload.config } as ExtensionConfig;
      break;

    case 'SWITCH_MODE':
      switchMode(message.payload.mode);
      break;
  }
}

function sendMessage(message: any) {
  vscode.postMessage(message);
}

// Mode switching
function toggleMode() {
  const newMode = currentMode.value === 'source' ? 'preview' : 'source';
  switchMode(newMode);
}

function switchMode(mode: EditorMode) {
  if (mode === currentMode.value) return;

  const previousMode = currentMode.value;
  currentMode.value = mode;

  // 同步内容
  if (previousMode === 'source' && mode === 'preview') {
    content.value = sourceContent.value;
  } else if (previousMode === 'preview' && mode === 'source') {
    sourceContent.value = content.value;
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus();
      }
    });
  }
}

// Event handlers
function handleChange(newContent: string) {
  content.value = newContent;
  sourceContent.value = newContent;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: newContent },
  });
}

function handleSourceChange() {
  content.value = sourceContent.value;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: sourceContent.value },
  });
}

function handleFormat(format: string) {
  if (currentMode.value === 'preview') {
    editorRef.value?.applyFormat(format);
  }
}

function handleInsert(type: string) {
  if (currentMode.value === 'preview') {
    editorRef.value?.insertNode(type);
  }
}

function handleImageClick(src: string, images: string[], index: number) {
  sendMessage({
    type: 'OPEN_IMAGE_PREVIEW',
    payload: { src, images, index },
  });
}

function handleImageContextMenu(src: string, x: number, y: number) {
  sendMessage({
    type: 'OPEN_IMAGE_EDITOR',
    payload: { src },
  });
}

// Lifecycle
onMounted(() => {
  window.addEventListener('message', handleMessage);
  sendMessage({ type: 'READY' });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // 触发重新计算
  });
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});
</script>

<style scoped>
.md-editor-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  overflow: hidden;
}

.editor-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.source-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.source-textarea {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 24px;
  border: none;
  outline: none;
  resize: none;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family, 'SF Mono', Consolas, monospace);
  font-size: v-bind('(config?.editor.fontSize || 14) * 1.5 + "px"');
  line-height: 1.6;
  tab-size: 2;
  box-sizing: border-box;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vscode-descriptionForeground);
}

.theme-dark {
  /* Dark theme specific styles */
}
</style>
