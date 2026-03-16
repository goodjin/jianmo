<template>
  <div class="toolbar">
    <!-- 第一行：模式切换、标题、格式 -->
    <div class="toolbar-row">
      <!-- 模式切换 -->
      <div class="toolbar-group mode-switch">
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'source' }"
          title="Source Mode"
          @click="$emit('switch-mode', 'source')"
        >
          <span class="btn-icon">{ }</span>
          <span class="btn-label">源码</span>
        </button>
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'preview' }"
          title="Preview Mode"
          @click="$emit('switch-mode', 'preview')"
        >
          <span class="btn-icon">👁</span>
          <span class="btn-label">预览</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 标题 -->
      <div class="toolbar-group">
        <button
          v-for="btn in headingButtons"
          :key="btn.id"
          class="toolbar-btn heading-btn"
          :title="btn.label"
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 格式 -->
      <div class="toolbar-group">
        <button
          v-for="btn in formatButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <!-- 导出按钮 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn export-btn"
          title="Export PDF"
          @click="$emit('export', 'pdf')"
        >
          <span class="btn-icon">📄</span>
          <span class="btn-label">PDF</span>
        </button>
        <button
          class="toolbar-btn export-btn"
          title="Export HTML"
          @click="$emit('export', 'html')"
        >
          <span class="btn-icon">🌐</span>
          <span class="btn-label">HTML</span>
        </button>
      </div>
    </div>

    <!-- 第二行：列表、插入、操作 -->
    <div class="toolbar-row">
      <!-- 列表 -->
      <div class="toolbar-group">
        <button
          v-for="btn in listButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 插入 -->
      <div class="toolbar-group">
        <button
          v-for="btn in insertButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          @click="$emit('insert', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <!-- 操作按钮 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          title="Undo"
          @click="$emit('undo')"
        >
          <span class="btn-icon">↩️</span>
          <span class="btn-label">撤销</span>
        </button>
        <button
          class="toolbar-btn"
          title="Redo"
          @click="$emit('redo')"
        >
          <span class="btn-icon">↪️</span>
          <span class="btn-label">重做</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 大纲切换 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: showOutline }"
          title="Toggle Outline"
          @click="$emit('toggle-outline')"
        >
          <span class="btn-icon">📋</span>
          <span class="btn-label">大纲</span>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <!-- 快捷键提示 -->
      <div class="toolbar-hint">
        <kbd>Cmd + \</kbd> Toggle
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorMode } from '../../../src/types';

const props = defineProps<{
  mode: EditorMode;
  showOutline?: boolean;
}>();

defineEmits<{
  (e: 'format', format: string): void;
  (e: 'insert', type: string): void;
  (e: 'switch-mode', mode: EditorMode): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'find-replace'): void;
  (e: 'toggle-outline'): void;
  (e: 'export', format: 'pdf' | 'html'): void;
}>();

const headingButtons = [
  { id: 'h1', icon: 'H1', shortLabel: 'H1', label: 'Heading 1' },
  { id: 'h2', icon: 'H2', shortLabel: 'H2', label: 'Heading 2' },
  { id: 'h3', icon: 'H3', shortLabel: 'H3', label: 'Heading 3' },
  { id: 'h4', icon: 'H4', shortLabel: 'H4', label: 'Heading 4' },
  { id: 'h5', icon: 'H5', shortLabel: 'H5', label: 'Heading 5' },
  { id: 'h6', icon: 'H6', shortLabel: 'H6', label: 'Heading 6' },
];

const formatButtons = [
  { id: 'bold', icon: 'B', shortLabel: '粗体', label: 'Bold' },
  { id: 'italic', icon: 'I', shortLabel: '斜体', label: 'Italic' },
  { id: 'strike', icon: 'S', shortLabel: '删除', label: 'Strikethrough' },
  { id: 'code', icon: '</>', shortLabel: '代码', label: 'Inline Code' },
  { id: 'highlight', icon: '🖍', shortLabel: '高亮', label: 'Highlight' },
  { id: 'subscript', icon: 'X₂', shortLabel: '下标', label: 'Subscript' },
  { id: 'superscript', icon: 'X²', shortLabel: '上标', label: 'Superscript' },
  { id: 'clearFormat', icon: '✕', shortLabel: '清除', label: 'Clear Format' },
];

const listButtons = [
  { id: 'bulletList', icon: '•', shortLabel: '无序', label: 'Bullet List' },
  { id: 'orderedList', icon: '1.', shortLabel: '有序', label: 'Ordered List' },
  { id: 'taskList', icon: '☐', shortLabel: '任务', label: 'Task List' },
  { id: 'quote', icon: '"', shortLabel: '引用', label: 'Quote' },
  { id: 'indent', icon: '→', shortLabel: '缩进', label: 'Indent' },
  { id: 'outdent', icon: '←', shortLabel: '取消', label: 'Outdent' },
];

const insertButtons = [
  { id: 'link', icon: '🔗', shortLabel: '链接', label: 'Link' },
  { id: 'image', icon: '🖼', shortLabel: '图片', label: 'Image' },
  { id: 'codeBlock', icon: '{ }', shortLabel: '代码块', label: 'Code Block' },
  { id: 'table', icon: '⊞', shortLabel: '表格', label: 'Table' },
  { id: 'hr', icon: '—', shortLabel: '分隔线', label: 'Horizontal Rule' },
  { id: 'toc', icon: '📋', shortLabel: '目录', label: 'Table of Contents' },
  { id: 'math', icon: '∑', shortLabel: '公式', label: 'Math Formula' },
  { id: 'footnote', icon: '¹', shortLabel: '脚注', label: 'Footnote' },
];
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 12px;
  background: var(--vscode-editorWidget-background);
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  gap: 4px;
  overflow-x: auto;
  min-height: auto;
}

.toolbar-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  width: 100%;
  gap: 4px;
}

.toolbar-group {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--vscode-editorWidget-border);
  margin: 0 6px;
  flex-shrink: 0;
}

.toolbar-spacer {
  flex: 1;
  min-width: 20px;
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  width: 46px;
  height: 46px;
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: background-color 0.15s;
  flex-shrink: 0;
  gap: 1px;
}

.toolbar-btn .btn-label {
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  opacity: 0.8;
}

.toolbar-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.toolbar-btn:active {
  background: var(--vscode-toolbar-activeBackground);
}

/* Mode switch buttons */
.mode-switch {
  gap: 0;
}

.mode-btn {
  min-width: auto;
  width: auto;
  padding: 4px 12px;
  gap: 4px;
  flex-direction: row;
}

.mode-btn .btn-label {
  font-size: 12px;
  opacity: 1;
}

.mode-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.mode-btn.active:hover {
  background: var(--vscode-button-hoverBackground);
}

.toolbar-hint {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-left: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.toolbar-hint kbd {
  background: var(--vscode-keybindingLabel-background);
  border: 1px solid var(--vscode-keybindingLabel-border);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
}

/* Heading buttons */
.heading-btn {
  font-size: 14px;
  font-weight: 700;
}

/* Export buttons */
.export-btn {
  width: auto;
  min-width: 70px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  gap: 2px;
}

.export-btn .btn-label {
  font-size: 10px;
}

/* Button icon and label */
.btn-icon {
  font-size: 16px;
  line-height: 1;
}

.btn-label {
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
