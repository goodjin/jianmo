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
        <!-- 编辑器容器 (源码模式由 CM6 处理) -->
        <div
          ref="editorContainerRef"
          class="cm-editor-container"
          v-show="editorReady && currentMode === 'source'"
        ></div>

        <!-- 预览容器 (预览模式渲染 HTML) -->
        <div
          v-show="editorReady && currentMode === 'preview'"
          ref="previewContainerRef"
          class="preview-container"
          v-html="previewHtml"
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
import { marked } from 'marked';
import type { ExtensionConfig, ExtensionMessage, EditorMode } from '../../src/types';

import { useVSCode } from './composables/useVSCode';
const { postMessage } = useVSCode();

// State
const content = ref('');
const config = ref<ExtensionConfig | null>(null);
const editorReady = ref(false);
const currentMode = ref<EditorMode>('preview');
const editorContainerRef = ref<HTMLElement | null>(null);
const previewContainerRef = ref<HTMLElement | null>(null);

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

// 标题 ID 生成（与 OutlinePanel 一致）
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// 配置 marked renderer，为标题添加 id
const renderer = new marked.Renderer();
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = generateHeadingId(text);
  return `<h${depth} id="${id}">${text}</h${depth}>`;
};
marked.use({ renderer });

// Preview HTML
const previewHtml = computed(() => {
  if (!content.value) return '';
  return marked.parse(content.value, { async: false }) as string;
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
function toggleMode() {
  const newMode = currentMode.value === 'source' ? 'preview' : 'source';
  switchMode(newMode);
}

function switchMode(mode: EditorMode) {
  if (mode === currentMode.value) return;

  if (mode === 'source') {
    // 切换到源码模式：保存预览滚动比例，恢复到 CM 对应位置
    const preview = previewContainerRef.value;
    const previewRatio = preview && preview.scrollHeight > 0
      ? preview.scrollTop / preview.scrollHeight : 0;

    // 只在没有未保存的更改时才设置内容（避免重置光标）
    const currentEditorContent = editor.getContent();
    if (currentEditorContent !== content.value) {
      editor.setContent(content.value);
    }
    currentMode.value = mode;

    // 使用 setTimeout 确保 CodeMirror 已完全渲染并恢复光标位置
    setTimeout(() => {
      const scroller = document.querySelector('.cm-scroller') as HTMLElement;
      if (scroller && scroller.scrollHeight > 0) {
        scroller.scrollTop = previewRatio * scroller.scrollHeight;
      }
      // 恢复编辑器焦点
      editor.view.value?.focus();
    }, 50);
  } else {
    // 切换到预览模式：保存 CM 滚动比例，恢复到预览对应位置
    const scroller = document.querySelector('.cm-scroller') as HTMLElement;
    const sourceRatio = scroller && scroller.scrollHeight > 0
      ? scroller.scrollTop / scroller.scrollHeight : 0;

    content.value = editor.getContent();
    currentMode.value = mode;

    // 使用 setTimeout 确保预览容器已完全渲染
    setTimeout(() => {
      const preview = previewContainerRef.value;
      if (preview && preview.scrollHeight > 0) {
        preview.scrollTop = sourceRatio * preview.scrollHeight;
      }
    }, 50);
  }
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
  try {
    editor.applyFormat(format);
    editor.view.value?.focus();
  } catch (err) {
    console.warn('[Editor] applyFormat failed:', err);
  }
}

function handleInsert(type: string) {
  try {
    editor.insertNode(type);
    editor.view.value?.focus();
  } catch (err) {
    console.warn('[Editor] insertNode failed:', err);
  }
}

function handleUndo() {
  try {
    editor.undo();
    // 恢复编辑器焦点，否则后续快捷键不生效
    editor.view.value?.focus();
  } catch (err) {
    console.warn('[Editor] undo failed:', err);
  }
}

function handleRedo() {
  try {
    editor.redo();
    editor.view.value?.focus();
  } catch (err) {
    console.warn('[Editor] redo failed:', err);
  }
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
  if (!findText) return;

  if (currentMode.value === 'source' && editor.view.value) {
    // Source 模式：在 CodeMirror 内容中替换
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
      // 转义特殊字符
      const escaped = findText.replace(/[.*+?^${}()|[\]]/g, '\\$&');
      const regex = new RegExp(escaped, flags);
      currentContent = currentContent.replace(regex, replaceText);
    }

    editor.setContent(currentContent);
  } else {
    // Preview 模式：使用 DOM 替换（有限支持）
    const container = document.querySelector('.preview-container');
    if (!container) return;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
      textNodes.push(node as Text);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const flags = options.caseSensitive ? 'g' : 'gi';

      let newText: string;
      if (options.useRegex) {
        try {
          const regex = new RegExp(findText, flags);
          newText = text.replace(regex, replaceText);
        } catch (e) {
          continue;
        }
      } else {
        const escaped = findText.replace(/[.*+?^${}()|[\]]/g, '\\$&');
        const regex = new RegExp(escaped, flags);
        newText = text.replace(regex, replaceText);
      }

      if (newText !== text) {
        textNode.textContent = newText;
      }
    }

    // 同步回源码内容
    const updatedHtml = container.innerHTML;
    // 注意：这里是从 HTML 转回 Markdown，可能会有格式损失
    // 更好的方式是在 source 模式下进行替换
  }
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

function handleOutlineJump(pos: number, headingId: string) {
  if (currentMode.value === 'preview') {
    // 预览模式：通过标题 id 在渲染 HTML 中定位并滚动
    const el = document.getElementById(headingId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    // 源码模式：CodeMirror 跳转
    if (editor.view.value) {
      editor.view.value.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true
      });
      editor.view.value.focus();
    }
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
  
  // 只在源码模式下处理编辑快捷键
  if (currentMode.value !== 'source') return;

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

.preview-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--vscode-editor-foreground);
}

.preview-container :deep(h1) { font-size: 2em; margin: 0.67em 0; border-bottom: 1px solid var(--vscode-editorWidget-border); padding-bottom: 0.3em; }
.preview-container :deep(h2) { font-size: 1.5em; margin: 0.75em 0; border-bottom: 1px solid var(--vscode-editorWidget-border); padding-bottom: 0.3em; }
.preview-container :deep(h3) { font-size: 1.25em; margin: 0.75em 0; }
.preview-container :deep(h4) { font-size: 1em; margin: 0.75em 0; }
.preview-container :deep(h5) { font-size: 0.875em; margin: 0.75em 0; }
.preview-container :deep(h6) { font-size: 0.85em; margin: 0.75em 0; color: var(--vscode-descriptionForeground); }

.preview-container :deep(p) { margin: 0.5em 0; }

.preview-container :deep(a) { color: var(--vscode-textLink-foreground, #3794ff); text-decoration: none; }
.preview-container :deep(a:hover) { text-decoration: underline; }

.preview-container :deep(code) {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
}

.preview-container :deep(pre) {
  background: var(--vscode-textCodeBlock-background);
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}

.preview-container :deep(pre code) {
  padding: 0;
  background: transparent;
}

.preview-container :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--vscode-textBlockQuote-border);
  color: var(--vscode-textBlockQuote-foreground);
}

.preview-container :deep(ul), .preview-container :deep(ol) {
  margin: 0.5em 0;
  padding-left: 2em;
}

.preview-container :deep(li) { margin: 0.25em 0; }

.preview-container :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
  width: auto;
}

.preview-container :deep(th), .preview-container :deep(td) {
  border: 1px solid var(--vscode-editorWidget-border);
  padding: 6px 12px;
}

.preview-container :deep(th) {
  background: var(--vscode-editorWidget-background);
  font-weight: 600;
}

.preview-container :deep(hr) {
  border: none;
  border-top: 1px solid var(--vscode-editorWidget-border);
  margin: 1.5em 0;
}

.preview-container :deep(img) {
  max-width: 100%;
  border-radius: 4px;
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
