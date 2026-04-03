<template>
  <div class="md-editor-app" :class="{ 'theme-dark': isDark }">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      :show-outline="showOutline"
      :show-line-numbers="showLineNumbers"
      @format="handleFormat"
      @insert="handleInsert"
      @switch-mode="switchMode"
      @undo="handleUndo"
      @redo="handleRedo"
      @find-replace="findReplaceVisible = true"
      @toggle-outline="showOutline = !showOutline"
      @toggle-line-numbers="handleToggleLineNumbers"
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
        <!-- 编辑器容器 (IR 模式和源码模式由 CM6 处理) -->
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
        v-if="editorReady && showOutline"
        :content="content"
        :current-mode="currentMode"
        @jump="handleOutlineJump"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useEditor } from './composables/useEditor';
import Toolbar from './components/Toolbar.vue';
import OutlinePanel from './components/OutlinePanel.vue';
import FindReplacePanel from './components/FindReplacePanel.vue';
import ImagePreview from './components/ImagePreview.vue';
import { hasToc, updateTocInContent } from './utils/toc';
import { skipWindowUndoRedoWhenEditorFocused } from './utils/undoRedoKeys';
import type { ExtensionConfig, ExtensionMessage, EditorMode } from '../../src/types';
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';

import { useVSCode } from './composables/useVSCode';
const { postMessage } = useVSCode();

declare global {
  interface Window {
    __marklyE2E?: {
      getContent: () => string;
      setContent: (c: string) => void;
      applyFormat: (format: string) => void;
      insertNode: (type: string) => void;
      undo: () => void;
      redo: () => void;
      switchMode: (mode: EditorMode) => void;
      replaceAll: (
        findText: string,
        replaceText: string,
        options: { caseSensitive: boolean; useRegex: boolean }
      ) => void;
      getUndoDepth: () => number;
      getRedoDepth: () => number;
      undoCmd: () => boolean;
      redoCmd: () => boolean;
    };
  }
}

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
const showLineNumbers = ref(true); // 行号显示开关

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

/** 确保 CM6 已挂载到容器并完成 INIT（避免宿主过早 postMessage INIT 时 ref 未就绪 → 永久 Loading） */
function ensureEditorFromInit(): boolean {
  const el = editorContainerRef.value;
  if (!el) return false;
  if (!editor.view.value) {
    editor.createEditor(el);
    el.addEventListener('click', handleGlobalClick);
    el.addEventListener('contextmenu', handleGlobalContextMenu);
  }
  editor.setContent(content.value);
  editorReady.value = true;
  console.log('[Webview] editorReady set to true');

  // e2e 调试桥：让真 UI 测试能稳定读取/驱动编辑器状态（不依赖 DOM 可见文本/落盘时序）
  window.__marklyE2E = {
    getContent: () => editor.getContent(),
    setContent: (c: string) => {
      content.value = c;
      editor.setContent(c);
    },
    applyFormat: (format: string) => handleFormat(format),
    insertNode: (type: string) => handleInsert(type),
    undo: () => handleUndo(),
    redo: () => handleRedo(),
    switchMode: (mode: EditorMode) => switchMode(mode),
    replaceAll: (findText, replaceText, options) => handleReplaceAll(findText, replaceText, options),
    getUndoDepth: () => (editor.view.value ? undoDepth(editor.view.value.state) : 0),
    getRedoDepth: () => (editor.view.value ? redoDepth(editor.view.value.state) : 0),
    undoCmd: () => {
      const v = editor.view.value;
      return v ? undo({ state: v.state, dispatch: v.dispatch }) : false;
    },
    redoCmd: () => {
      const v = editor.view.value;
      return v ? redo({ state: v.state, dispatch: v.dispatch }) : false;
    },
  };

  return true;
}

function scheduleEnsureEditorFromInit() {
  if (ensureEditorFromInit()) return;
  nextTick(() => {
    if (ensureEditorFromInit()) return;
    requestAnimationFrame(() => {
      ensureEditorFromInit();
    });
  });
}

// Message handling
function handleMessage(event: MessageEvent) {
  const message: ExtensionMessage = event.data;
  console.log('[Webview] Received message:', message.type, message);

  switch (message.type) {
    case 'INIT':
      console.log('[Webview] INIT received, content length:', message.payload.content?.length);
      content.value = message.payload.content;
      config.value = message.payload.config;
      scheduleEnsureEditorFromInit();
      break;

    case 'CONTENT_UPDATE':
      // 只有内容真正变化时才更新，避免重置光标位置
      if (message.payload.content !== content.value) {
        content.value = message.payload.content;
        editor.setContent(message.payload.content);
      }
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
function switchMode(mode: EditorMode) {
  if (mode === currentMode.value) return;

  // 保存当前滚动位置
  const scroller = document.querySelector('.cm-scroller') as HTMLElement;
  let scrollRatio = 0;

  if (scroller) {
    scrollRatio = scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
  }

  // 切换到 IR 或 Source 模式
  const currentEditorContent = editor.getContent();
  if (currentEditorContent !== content.value) {
    editor.setContent(content.value);
  }
  // 通过 composable 切换 CM6 state（否则只是 UI 状态变化，编辑器本身不会换模式）
  editor.switchMode(mode);

  // 恢复滚动位置
  setTimeout(() => {
    const newScroller = document.querySelector('.cm-scroller') as HTMLElement;
    if (newScroller && newScroller.scrollHeight > 0) {
      newScroller.scrollTop = scrollRatio * newScroller.scrollHeight;
    }
    editor.view.value?.focus();
  }, 50);
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

function focusEditor() {
  // 使用 setTimeout 延迟 focus，避免与刚执行的 dispatch 冲突
  setTimeout(() => {
    try {
      editor.view.value?.focus();
    } catch (e) {
      console.warn('[Editor] focus failed:', e);
    }
  }, 0);
}

function handleFormat(format: string) {
  try {
    editor.applyFormat(format);
    focusEditor();
  } catch (err) {
    console.warn('[Editor] applyFormat failed:', err);
  }
}

function handleInsert(type: string) {
  try {
    editor.insertNode(type);
    focusEditor();
  } catch (err) {
    console.warn('[Editor] insertNode failed:', err);
  }
}

function handleToggleLineNumbers() {
  showLineNumbers.value = !showLineNumbers.value;
  editor.toggleLineNumbers();
}

function handleUndo() {
  try {
    editor.undo();
  } catch (e) {
    console.warn('[Editor] undo failed:', e);
  }
  focusEditor();
}

function handleRedo() {
  try {
    editor.redo();
  } catch (e) {
    console.warn('[Editor] redo failed:', e);
  }
  focusEditor();
}

// 查找替换处理函数
function handleFind(
  text: string,
  options: { caseSensitive: boolean; useRegex: boolean; direction: 'next' | 'prev' }
) {
  if (!text) return;

  // 统一使用浏览器原生查找
  // Preview 模式：查找渲染后的内容
  // Source 模式：查找源码（注意：CodeMirror 使用 contenteditable，window.find 可用）
  const caseSensitive = options.caseSensitive;
  const backward = options.direction === 'prev';

  const found = window.find(text, caseSensitive, backward, true, false, true, false);
  if (!found) {
    console.log('Find: text not found -', text);
  }
}

function handleReplace(
  findText: string,
  replaceText: string,
  options: { caseSensitive: boolean; useRegex: boolean }
) {
  if (!findText) return;

  // 使用 selection 获取当前选中的文本（由 handleFind 选中）
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const selectedText = selection.toString();
  const matches = options.caseSensitive
    ? selectedText === findText
    : selectedText.toLowerCase() === findText.toLowerCase();

  if (matches) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(replaceText));
    // 清除选择
    selection.removeAllRanges();
  }
}

function handleReplaceAll(
  findText: string,
  replaceText: string,
  options: { caseSensitive: boolean; useRegex: boolean }
) {
  if (!findText || !editor.view.value) return;

  let currentContent = editor.getContent();
  const flags = options.caseSensitive ? 'g' : 'gi';

  if (options.useRegex) {
    try {
      const regex = new RegExp(findText, flags);
      currentContent = currentContent.replace(regex, replaceText);
    } catch (e) {
      console.warn('Invalid regex:', findText);
      return;
    }
  } else {
    const escaped = findText.replace(/[.*+?^${}()|[\]]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    currentContent = currentContent.replace(regex, replaceText);
  }

  editor.setContent(currentContent);
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

function handleOutlineJump(pos: number, _headingId: string) {
  if (editor.view.value) {
    const view = editor.view.value;

    // 先移动光标
    view.dispatch({
      selection: { anchor: pos },
    });

    // 然后滚动到该位置
    requestAnimationFrame(() => {
      const dom = view.dom;
      const line = view.lineBlockAt(pos);
      if (line) {
        // 找到对应的 DOM 元素并滚动
        const scroller = view.scrollDOM;
        const coords = view.coordsAtPos(pos);
        if (coords && scroller) {
          scroller.scrollTop = coords.top - scroller.clientTop - 20;
        }
      }
    });

    focusEditor();
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

  if (ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        handleFormat('bold');
        break;
      case 'i':
        e.preventDefault();
        handleFormat('italic');
        break;
      case 'k':
        e.preventDefault();
        if (e.shiftKey) {
          handleInsert('codeBlock');
        } else {
          handleInsert('link');
        }
        break;
      // Note: Ctrl+M removed to avoid potential conflicts
      // Math formula can be inserted via toolbar button
      case 'f':
        e.preventDefault();
        findReplaceVisible.value = true;
        break;
      case 'z':
        // CM6 minimalSetup 的 historyKeymap 已绑定 Mod-z，且 preventDefault 后仍会冒泡到 window。
        // 若此处再 handleUndo，会在一次按键内连续执行两次原生 undo，易与 history/focus 微任务交织出错。
        if (skipWindowUndoRedoWhenEditorFocused(editor.view.value?.hasFocus)) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        break;
    }
  }

  // Tab 键缩进处理
  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      handleFormat('outdent');
    } else {
      handleFormat('indent');
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

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeListener);

  // ref + 子组件在首帧后才稳定；与 INIT 时序对齐，避免同步阶段 ref 仍为空
  nextTick(() => {
    const el = editorContainerRef.value;
    if (el && !editor.view.value) {
      editor.createEditor(el);
      el.addEventListener('click', handleGlobalClick);
      el.addEventListener('contextmenu', handleGlobalContextMenu);
    }
    sendMessage({ type: 'READY' });
    initRetryTimer = setTimeout(checkInitStatus, 1000);
  });
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
