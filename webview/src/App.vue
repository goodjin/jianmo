<template>
  <div class="md-editor-app" :class="{ 'theme-dark': isDark }">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      :show-outline="showOutline"
      @format="handleFormat"
      @insert="handleInsert"
      @switch-mode="switchMode"
      @undo="handleUndo"
      @redo="handleRedo"
      @find-replace="findReplaceVisible = true"
      @toggle-outline="showOutline = !showOutline"
      @export="handleExport"
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
      @find="handleFind"
      @replace="handleReplace"
      @replace-all="handleReplaceAll"
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
        <!-- 编辑器容器 (IR、源码、分屏都由 CM6 处理) -->
        <div
          ref="editorContainerRef"
          class="cm-editor-container"
          v-show="editorReady"
        ></div>

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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useEditor } from './composables/useEditor';
import Toolbar from './components/Toolbar.vue';
import OutlinePanel from './components/OutlinePanel.vue';
import FindReplacePanel from './components/FindReplacePanel.vue';
import ImagePreview from './components/ImagePreview.vue';
import { hasToc, updateTocInContent } from './utils/toc';
import type { ExtensionConfig, ExtensionMessage, EditorMode } from '../../src/types';

import { useVSCode } from './composables/useVSCode';
const { postMessage } = useVSCode();

// State
const content = ref('');
const config = ref<ExtensionConfig | null>(null);
const editorReady = ref(false);
const currentMode = ref<EditorMode>('ir');
const editorContainerRef = ref<HTMLElement | null>(null);

// Table formatting debounce
let tableFormatTimeout: ReturnType<typeof setTimeout> | null = null;
const TABLE_FORMAT_DELAY = 500; // ms

// Initialize useEditor hook
const editor = useEditor({
  initialContent: '',
  initialMode: currentMode.value,
  onChange: (newContent: string) => {
    content.value = newContent;
    sendMessage({
      type: 'CONTENT_CHANGE',
      payload: { content: newContent },
    });
  },
  onModeChange: (newMode: EditorMode) => {
    currentMode.value = newMode;
  }
});

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
  console.log('[Webview] Received message:', message.type, message);

  switch (message.type) {
    case 'INIT':
      console.log('[Webview] INIT received, content length:', message.payload.content?.length);
      content.value = message.payload.content;
      config.value = message.payload.config;

      // Initialize editor when INIT is received
      if (editorContainerRef.value) {
        editor.setContent(content.value);
        editorReady.value = true;
        console.log('[Webview] editorReady set to true');
      }
      break;

    case 'CONTENT_UPDATE':
      content.value = message.payload.content;
      editor.setContent(message.payload.content);
      break;

    case 'CONFIG_CHANGE':
      // 防御性编程：确保 config.value 不为 null
      if (config.value) {
        config.value = { ...config.value, ...message.payload.config } as ExtensionConfig;
      } else {
        config.value = message.payload.config as ExtensionConfig;
      }
      break;

    case 'SWITCH_MODE':
      switchMode(message.payload.mode);
      break;
      
    case 'SAVE':
      // VS Code 触发的保存，也需要更新 TOC
      saveWithTocUpdate();
      break;

    default:
      // Unknown message type - ignore silently
      break;
  }
}

function sendMessage(message: any) {
  postMessage(message);
}

// 编辑器准备好后的回调
function handleEditorReady(success: boolean) {
  if (!success) {
    console.error('Editor initialization failed');
    // 可以在这里显示错误提示或重试逻辑
  }
}

// Mode switching
function toggleMode() {
  const newMode = currentMode.value === 'source' ? 'preview' : 'source';
  switchMode(newMode);
}

function switchMode(mode: EditorMode) {
  if (mode === currentMode.value) return;
  editor.switchMode(mode);
}

// Event handlers
function handleChange(newContent: string) {
  content.value = newContent;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: newContent },
  });
}

// 保存文件时处理
function saveWithTocUpdate() {
  let updatedContent = editor.getContent();

  // 检查并更新 TOC
  if (hasToc(updatedContent)) {
    updatedContent = updateTocInContent(updatedContent);
    // 同步回编辑器
    if (updatedContent !== editor.getContent()) {
      editor.setContent(updatedContent);
      content.value = updatedContent;
    }
  }

  // 发送保存消息
  sendMessage({
    type: 'SAVE',
    payload: { content: updatedContent },
  });
}

function handleFormat(format: string) {
  editor.applyFormat(format);
}

function handleInsert(type: string) {
  editor.insertNode(type);
}

function handleUndo() {
  editor.undo();
}

function handleRedo() {
  editor.redo();
}

// 查找替换处理函数
function handleFind(
  text: string,
  options: { caseSensitive: boolean; useRegex: boolean; direction: 'next' | 'prev' }
) {
  // TODO: 实现编辑器内查找高亮
  console.log('Find:', text, options);
}

function handleReplace(
  findText: string,
  replaceText: string,
  options: { caseSensitive: boolean; useRegex: boolean }
) {
  // TODO: 实现单处替换
  console.log('Replace:', findText, '->', replaceText, options);
}

function handleReplaceAll(
  findText: string,
  replaceText: string,
  options: { caseSensitive: boolean; useRegex: boolean }
) {
  // TODO: 实现全部替换
  console.log('Replace All:', findText, '->', replaceText, options);
}

// 解析图片 URL（处理相对路径）
function resolveImageUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('file://')) {
    return src;
  }
  const baseUrl = document.baseURI || '';
  if (baseUrl) {
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return src;
    }
  }
  return src;
}

// Global click handler to intercept image clicks
function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'IMG') {
    const src = target.getAttribute('src') || '';
    const resolvedSrc = resolveImageUrl(src);

    const images = Array.from(document.querySelectorAll('.cm-editor-container img'))
      .map((img) => resolveImageUrl(img.getAttribute('src') || ''));
    const index = images.indexOf(resolvedSrc);

    currentImageSrc.value = resolvedSrc;
    currentImages.value = images;
    currentImageIndex.value = index;
    imagePreviewVisible.value = true;
  }
}

// Global context menu handler for images
function handleGlobalContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'IMG') {
    e.preventDefault();
    const src = target.getAttribute('src') || '';
    const resolvedSrc = resolveImageUrl(src);
    sendMessage({
      type: 'OPEN_IMAGE_EDITOR',
      payload: { src: resolvedSrc },
    });
  }
}

function handleOutlineJump(pos: number) {
  if (editor.view.value) {
    editor.view.value.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true
    });
    // Give focus back to editor
    editor.view.value.focus();
  }
}

// 导出处理函数
function handleExport(format: 'pdf' | 'html') {
  sendMessage({
    type: 'EXPORT',
    payload: { format },
  });
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
        editor.applyFormat('bold');
        break;
      case 'i':
        e.preventDefault();
        editor.applyFormat('italic');
        break;
      case 'k':
        e.preventDefault();
        if (e.shiftKey) {
          editor.insertNode('codeBlock');
        } else {
          editor.insertNode('link');
        }
        break;
      case 'm':
        if (e.shiftKey) {
          e.preventDefault();
          editor.insertNode('math');
        }
        break;
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        break;
    }
  }

  // Tab 键缩进处理
  if (e.key === 'Tab') {
    e.preventDefault();
    if (currentMode.value === 'preview') {
      if (e.shiftKey) {
        editor.applyFormat('outdent');
      } else {
        editor.applyFormat('indent');
      }
    }
  }

}

// Theme change listener - 主题变化时触发重新计算
const themeChangeListener = () => {
  // 强制触发 isDark computed 重新计算
  // 通过触发一个空的状态变化来让 Vue 重新渲染
  if (config.value) {
    config.value = { ...config.value };
  }
};

// 初始化重试机制
let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_INIT_RETRIES = 5;
let initRetryCount = 0;

function checkInitStatus() {
  if (editorReady.value) {
    if (initRetryTimer) clearTimeout(initRetryTimer);
    return;
  }

  if (initRetryCount < MAX_INIT_RETRIES) {
    initRetryCount++;
    console.log(`[Webview] Retrying READY message (${initRetryCount}/${MAX_INIT_RETRIES})...`);
    sendMessage({ type: 'READY' });
    initRetryTimer = setTimeout(checkInitStatus, 1000);
  } else {
    console.error('[Webview] Failed to initialize after multiple retries.');
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeyDown);

  // Wait for next tick to ensure VS Code API is acquired
  nextTick(() => {
    sendMessage({ type: 'READY' });
    initRetryTimer = setTimeout(checkInitStatus, 1000);
  });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeListener);

  // 监听图片点击和右键菜单 (用于 CM6 装饰器渲染出的 DOM 元素)
  if (editorContainerRef.value) {
    editor.createEditor(editorContainerRef.value);
    editorContainerRef.value.addEventListener('click', handleGlobalClick);
    editorContainerRef.value.addEventListener('contextmenu', handleGlobalContextMenu);
  }
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeChangeListener);

  if (editorContainerRef.value) {
    editorContainerRef.value.removeEventListener('click', handleGlobalClick);
    editorContainerRef.value.removeEventListener('contextmenu', handleGlobalContextMenu);
  }

  // Destroy editor
  editor.destroy();

  // Clear table format timeout
  if (tableFormatTimeout) {
    clearTimeout(tableFormatTimeout);
    tableFormatTimeout = null;
  }
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
  position: relative;
}

.cm-editor-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
}

/* Ensure CodeMirror takes full height */
:deep(.cm-editor) {
  height: 100%;
  width: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
  padding: 24px;
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
