<template>
  <div class="md-editor-app" :class="{ 'theme-dark': isDark }">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      :show-outline="showOutline"
      @format="handleFormat"
      @insert="handleInsert"
      @toggle-mode="toggleMode"
      @undo="handleUndo"
      @redo="handleRedo"
      @find-replace="findReplaceVisible = true"
      @toggle-outline="showOutline = !showOutline"
    />
    <!-- 字数统计 -->
    <div class="word-count" v-if="editorReady">
      <span>字数: {{ wordCount }}</span>
      <span>字符: {{ charCount }}</span>
      <span>行数: {{ lineCount }}</span>
    </div>

    <!-- 查找替换面板 -->
    <FindReplacePanel
      :visible="findReplaceVisible"
      :content="content"
      @close="findReplaceVisible = false"
    />

    <!-- 图片预览弹窗 -->
    <ImagePreview
      :visible="imagePreviewVisible"
      :src="currentImageSrc"
      :images="currentImages"
      :index="currentImageIndex"
      @close="imagePreviewVisible = false"
    />

    <div class="editor-main">
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

      <!-- 大纲视图 -->
      <OutlinePanel
        v-if="currentMode === 'preview' && editorReady && showOutline"
        :content="content"
        :current-mode="currentMode"
        @jump="handleOutlineJump"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import MilkdownEditor from './components/MilkdownEditor.vue';
import Toolbar from './components/Toolbar.vue';
import OutlinePanel from './components/OutlinePanel.vue';
import FindReplacePanel from './components/FindReplacePanel.vue';
import ImagePreview from './components/ImagePreview.vue';
import { formatTablesInContent } from './utils/tableFormatter';
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

// Table formatting debounce
let tableFormatTimeout: ReturnType<typeof setTimeout> | null = null;
const TABLE_FORMAT_DELAY = 500; // ms

// UI state
const findReplaceVisible = ref(false);
const imagePreviewVisible = ref(false);
const currentImages = ref<string[]>([]);
const currentImageIndex = ref(0);
const currentImageSrc = ref('');
const showOutline = ref(true); // 大纲视图开关

// Word count
const wordCount = computed(() => {
  if (!content.value) return 0;
  // Count Chinese characters and English words
  const chineseChars = (content.value.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.value.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
});

const charCount = computed(() => {
  return content.value?.length || 0;
});

const lineCount = computed(() => {
  if (!content.value) return 0;
  return content.value.split('\n').length;
});

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
      
    case 'SAVE':
      // VS Code 触发的保存，也需要更新 TOC
      saveWithTocUpdate();
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
  // Clear any pending table format
  if (tableFormatTimeout) {
    clearTimeout(tableFormatTimeout);
  }
  
  // Debounce table formatting for better UX
  tableFormatTimeout = setTimeout(() => {
    const currentContent = sourceContent.value;
    // Quick check if content has table potential
    if (currentContent.includes('|')) {
      const formatted = formatTablesInContent(currentContent);
      if (formatted !== currentContent) {
        // Save cursor position
        const cursorPos = textareaRef.value?.selectionStart || 0;
        sourceContent.value = formatted;
        // Try to restore cursor position (approximate)
        nextTick(() => {
          if (textareaRef.value) {
            textareaRef.value.setSelectionRange(cursorPos, cursorPos);
          }
        });
      }
    }
  }, TABLE_FORMAT_DELAY);
  
  content.value = sourceContent.value;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: sourceContent.value },
  });
}

// 保存文件时自动更新 TOC
function saveWithTocUpdate() {
  // 检查并更新 TOC
  if (editorRef.value?.hasToc(content.value)) {
    editorRef.value.updateToc();
    // 获取更新后的内容
    const updatedContent = editorRef.value.getContent();
    content.value = updatedContent;
    sourceContent.value = updatedContent;
  }
  
  // 发送保存消息
  sendMessage({
    type: 'SAVE',
    payload: { content: content.value },
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

function handleUndo() {
  if (currentMode.value === 'preview') {
    editorRef.value?.undo();
  }
}

function handleRedo() {
  if (currentMode.value === 'preview') {
    editorRef.value?.redo();
  }
}

function handleImageClick(src: string, images: string[], index: number) {
  currentImageSrc.value = src;
  currentImages.value = images;
  currentImageIndex.value = index;
  imagePreviewVisible.value = true;
}

function handleImageContextMenu(src: string, x: number, y: number) {
  sendMessage({
    type: 'OPEN_IMAGE_EDITOR',
    payload: { src },
  });
}

function handleOutlineJump(pos: number) {
  // 大纲跳转暂不实现，需要编辑器支持
  console.log('Jump to position:', pos);
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

  // Cmd/Ctrl + S: 保存并更新 TOC
  if (ctrlKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveWithTocUpdate();
    return;
  }
  
  // 只在预览模式下处理其他快捷键
  if (currentMode.value !== 'preview') return;

  if (ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        editorRef.value?.applyFormat('bold');
        break;
      case 'i':
        e.preventDefault();
        editorRef.value?.applyFormat('italic');
        break;
      case 'k':
        e.preventDefault();
        if (e.shiftKey) {
          editorRef.value?.insertNode('codeBlock');
        } else {
          editorRef.value?.insertNode('link');
        }
        break;
      case 'm':
        if (e.shiftKey) {
          e.preventDefault();
          editorRef.value?.insertNode('math');
        }
        break;
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          editorRef.value?.redo();
        } else {
          editorRef.value?.undo();
        }
        break;
    }
  }

  // Tab 键缩进处理
  if (e.key === 'Tab') {
    e.preventDefault();
    if (currentMode.value === 'preview') {
      if (e.shiftKey) {
        editorRef.value?.applyFormat('outdent');
      } else {
        editorRef.value?.applyFormat('indent');
      }
    }
  }

}

// Lifecycle
onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeyDown);
  sendMessage({ type: 'READY' });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // 触发重新计算
  });
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
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

.editor-main {
  flex: 1;
  display: flex;
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

.word-count {
  display: flex;
  gap: 16px;
  padding: 6px 16px;
  background: var(--vscode-editorWidget-background);
  border-top: 1px solid var(--vscode-editorWidget-border);
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.word-count span {
  white-space: nowrap;
}
</style>
