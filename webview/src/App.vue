<template>
  <div class="md-editor-app" :class="{ 'theme-dark': isDark }">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      @format="handleFormat"
      @insert="handleInsert"
      @switch-mode="switchMode"
      @undo="handleUndo"
      @redo="handleRedo"
      @find-replace="findReplaceVisible = true"
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
          @ready="handleEditorReady"
        />

        <div v-if="!editorReady" class="loading">
          <span>Loading editor...</span>
        </div>
      </div>

      <!-- 大纲视图 -->
      <OutlinePanel
        v-if="currentMode === 'preview' && editorReady"
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

// 等待编辑器准备好的辅助函数
function waitForEditorReady(): Promise<void> {
  return new Promise((resolve) => {
    // 如果编辑器已经准备好，立即解决
    if (editorReady.value && editorRef.value?.getContent !== undefined) {
      resolve();
      return;
    }
    
    // 否则等待一小段时间让编辑器完成初始化
    // 使用轮询方式，最多等待 2 秒
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      attempts++;
      if (editorReady.value && editorRef.value?.getContent !== undefined) {
        clearInterval(interval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('waitForEditorReady: timeout, editor may not be ready');
        resolve();
      }
    }, 100);
  });
}

// UI state
const findReplaceVisible = ref(false);
const imagePreviewVisible = ref(false);
const currentImages = ref<string[]>([]);
const currentImageIndex = ref(0);
const currentImageSrc = ref('');

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
  vscode.postMessage(message);
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

  // Immediately update content and notify (no debounce for content sync)
  const currentInput = sourceContent.value;
  content.value = currentInput;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: currentInput },
  });

  // Debounce table formatting only - don't block content updates
  tableFormatTimeout = setTimeout(() => {
    // Quick check if content has table potential
    if (currentInput.includes('|')) {
      const formatted = formatTablesInContent(currentInput);
      if (formatted !== currentInput) {
        // Calculate cursor offset based on character difference
        const cursorPos = textareaRef.value?.selectionStart || 0;
        const oldLength = currentInput.length;
        const newLength = formatted.length;
        const offset = newLength - oldLength;

        // Update content with formatted result
        sourceContent.value = formatted;
        content.value = formatted;
        sendMessage({
          type: 'CONTENT_CHANGE',
          payload: { content: formatted },
        });

        // Restore cursor position with offset adjustment
        nextTick(() => {
          if (textareaRef.value) {
            const newPos = Math.min(cursorPos + offset, formatted.length);
            textareaRef.value.setSelectionRange(newPos, newPos);
          }
        });
      }
    }
  }, TABLE_FORMAT_DELAY);
}

// 保存文件时自动更新 TOC
function saveWithTocUpdate() {
  // 检查并更新 TOC
  if (editorRef.value?.hasToc(content.value)) {
    editorRef.value.updateToc();
  }
  
  // 直接使用 content.value，而不是 getContent()（可能返回过期数据）
  const updatedContent = content.value;
  sourceContent.value = updatedContent;
  
  // 发送保存消息
  sendMessage({
    type: 'SAVE',
    payload: { content: updatedContent },
  });
}

function handleFormat(format: string) {
  if (currentMode.value === 'source') {
    // 源码模式下，先切换到预览模式
    switchMode('preview');
    // 等待 Milkdown 编辑器完全初始化后再执行格式操作
    waitForEditorReady().then(() => {
      editorRef.value?.applyFormat(format);
    });
  } else {
    editorRef.value?.applyFormat(format);
  }
}

function handleInsert(type: string) {
  if (currentMode.value === 'source') {
    // 源码模式下，先切换到预览模式
    switchMode('preview');
    // 等待 Milkdown 编辑器完全初始化后再执行插入操作
    waitForEditorReady().then(() => {
      editorRef.value?.insertNode(type);
    });
  } else {
    editorRef.value?.insertNode(type);
  }
}

function handleUndo() {
  if (currentMode.value === 'source') {
    // 源码模式下，先切换到预览模式
    switchMode('preview');
    waitForEditorReady().then(() => {
      editorRef.value?.undo();
    });
  } else {
    editorRef.value?.undo();
  }
}

function handleRedo() {
  if (currentMode.value === 'source') {
    // 源码模式下，先切换到预览模式
    switchMode('preview');
    waitForEditorReady().then(() => {
      editorRef.value?.redo();
    });
  } else {
    editorRef.value?.redo();
  }
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
  if (currentMode.value === 'source') {
    // 源码模式：跳转到文本位置
    const lines = sourceContent.value.split('\n');
    let charCount = 0;
    let targetLine = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= pos) {
        targetLine = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }

    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus();
        textareaRef.value.setSelectionRange(charCount, charCount);
        // Scroll to line
        const lineHeight = 1.6 * 21; // line-height * font-size
        textareaRef.value.scrollTop = targetLine * lineHeight;
      }
    });
  } else {
    // 预览模式：通过编辑器跳转
    if (editorRef.value?.scrollToHeading) {
      editorRef.value.scrollToHeading(pos);
    } else {
      console.log('Jump to heading:', pos);
    }
  }
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

// Theme change listener reference
const themeChangeListener = () => {
  // Trigger recompute
};

// Lifecycle
onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeyDown);
  sendMessage({ type: 'READY' });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeListener);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeChangeListener);
  
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
  font-size: 21px;
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
