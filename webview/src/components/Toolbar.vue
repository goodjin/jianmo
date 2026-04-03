<template>
  <div class="toolbar">
    <!-- 第一行：模式切换、标题、格式 -->
    <div class="toolbar-row">
      <!-- 模式切换 -->
      <div class="toolbar-group mode-switch">
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'ir' }"
          title="IR Mode (WYSIWYG)"
          @click="$emit('switch-mode', 'ir')"
        >
          <span class="btn-icon">&#x270E;</span>
          <span class="mode-label">IR</span>
        </button>
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'source' }"
          title="Source Mode"
          @click="$emit('switch-mode', 'source')"
        >
          <span class="btn-icon">{ }</span>
          <span class="mode-label">Source</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 标题 -->
      <div class="toolbar-group">
        <button
          v-for="btn in headingButtons"
          :key="btn.id"
          class="toolbar-btn heading-btn has-label"
          :title="btn.label"
          @mousedown.prevent
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
          class="toolbar-btn has-label"
          :title="btn.label"
          @mousedown.prevent
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
          class="toolbar-btn export-btn has-label"
          title="Export PDF"
          @click="$emit('export', 'pdf')"
        >
          <span class="btn-icon">&#x1F4C4;</span>
          <span class="btn-label">PDF</span>
        </button>
        <button
          class="toolbar-btn export-btn has-label"
          title="Export HTML"
          @click="$emit('export', 'html')"
        >
          <span class="btn-icon">&#x1F310;</span>
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
          class="toolbar-btn has-label"
          :title="btn.label"
          @mousedown.prevent
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
          class="toolbar-btn has-label"
          :title="btn.label"
          @mousedown.prevent
          @click="$emit('insert', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 撤销/重做 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn has-label"
          title="Undo (Ctrl+Z)"
          @mousedown.prevent
          @click="$emit('undo')"
        >
          <span class="btn-icon">&#x21A9;</span>
          <span class="btn-label">Undo</span>
        </button>
        <button
          class="toolbar-btn has-label"
          title="Redo (Ctrl+Shift+Z)"
          @mousedown.prevent
          @click="$emit('redo')"
        >
          <span class="btn-icon">&#x21AA;</span>
          <span class="btn-label">Redo</span>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <!-- 查找替换 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn has-label"
          :class="{ active: findPanelOpen }"
          type="button"
          title="查找和替换 (Ctrl+F)"
          @mousedown.prevent
          @click="$emit('find-replace')"
        >
          <span class="btn-icon">&#x2315;</span>
          <span class="btn-label">Find</span>
        </button>
      </div>

      <!-- 大纲切换 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn has-label"
          :class="{ active: showOutline }"
          title="Toggle Outline"
          @click="$emit('toggle-outline')"
        >
          <span class="btn-icon">&#x2630;</span>
          <span class="btn-label">Outline</span>
        </button>
      </div>

      <!-- 行号切换 -->
      <div class="toolbar-group">
        <button
          class="toolbar-btn has-label"
          :class="{ active: showLineNumbers }"
          title="Toggle Line Numbers"
          @click="$emit('toggle-line-numbers')"
        >
          <span class="btn-icon">#</span>
          <span class="btn-label">Lines</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorMode } from '../../../src/types';

defineProps<{
  mode: EditorMode;
  showOutline?: boolean;
  showLineNumbers?: boolean;
  /** 查找面板是否打开（工具栏高亮） */
  findPanelOpen?: boolean;
}>();

defineEmits<{
  (e: 'format', format: string): void;
  (e: 'insert', type: string): void;
  (e: 'switch-mode', mode: EditorMode): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'find-replace'): void;
  (e: 'toggle-outline'): void;
  (e: 'toggle-line-numbers'): void;
  (e: 'export', format: 'pdf' | 'html'): void;
}>();

const headingButtons = [
  { id: 'h1', icon: 'H1', shortLabel: 'H1', label: 'Heading 1' },
  { id: 'h2', icon: 'H2', shortLabel: 'H2', label: 'Heading 2' },
  { id: 'h3', icon: 'H3', shortLabel: 'H3', label: 'Heading 3' },
  { id: 'h4', icon: 'H4', shortLabel: 'H4', label: 'Heading 4' },
];

const formatButtons = [
  { id: 'bold', icon: 'B', shortLabel: 'Bold', label: 'Bold' },
  { id: 'italic', icon: 'I', shortLabel: 'Italic', label: 'Italic' },
  { id: 'strike', icon: 'S', shortLabel: 'Strike', label: 'Strikethrough' },
  { id: 'code', icon: '</>', shortLabel: 'Code', label: 'Inline Code' },
  { id: 'clear', icon: 'T', shortLabel: 'Normal', label: 'Clear Format' },
];

const listButtons = [
  { id: 'bulletList', icon: '\u2022', shortLabel: 'List', label: 'Bullet List' },
  { id: 'orderedList', icon: '1.', shortLabel: 'Num', label: 'Ordered List' },
  { id: 'taskList', icon: '\u2610', shortLabel: 'Task', label: 'Task List' },
  { id: 'quote', icon: '\u201C', shortLabel: 'Quote', label: 'Quote' },
];

const insertButtons = [
  { id: 'link', icon: '\uD83D\uDD17', shortLabel: 'Link', label: 'Link' },
  { id: 'image', icon: '\uD83D\uDDBC', shortLabel: 'Image', label: 'Image' },
  { id: 'codeBlock', icon: '{ }', shortLabel: 'Block', label: 'Code Block' },
  { id: 'table', icon: '\u229E', shortLabel: 'Table', label: 'Table' },
  { id: 'hr', icon: '\u2014', shortLabel: 'Line', label: 'Horizontal Rule' },
  { id: 'math', icon: '\u2211', shortLabel: 'Math', label: 'Math Formula' },
];
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 14px;
  background: var(--vscode-editorWidget-background);
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  gap: 6px;
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
  height: 32px;
  background: var(--vscode-editorWidget-border);
  margin: 0 6px;
  flex-shrink: 0;
}

.toolbar-spacer {
  flex: 1;
  min-width: 12px;
}

/* 基础按钮：增大 20% (32 -> 38) */
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: background-color 0.15s;
  flex-shrink: 0;
}

/* 带标签的按钮：纵向排列，图标 + 文字 */
.toolbar-btn.has-label {
  flex-direction: column;
  gap: 1px;
  width: auto;
  min-width: 38px;
  height: auto;
  padding: 3px 5px;
}

.btn-icon {
  font-size: 16px;
  line-height: 1.2;
}

.btn-label {
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  opacity: 0.7;
  white-space: nowrap;
}

.toolbar-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.toolbar-btn:hover .btn-label {
  opacity: 1;
}

.toolbar-btn:active {
  background: var(--vscode-toolbar-activeBackground);
}

.toolbar-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.toolbar-btn.active .btn-label {
  opacity: 1;
}

.toolbar-btn.active:hover {
  background: var(--vscode-button-hoverBackground);
}

/* Mode switch buttons */
.mode-switch {
  gap: 0;
}

.mode-btn {
  flex-direction: row;
  min-width: auto;
  width: auto;
  padding: 5px 12px;
  gap: 5px;
}

.mode-label {
  font-size: 13px;
  font-weight: 500;
}

/* Heading buttons */
.heading-btn .btn-icon {
  font-size: 14px;
  font-weight: 700;
}

/* Export buttons */
.export-btn {
  min-width: 44px;
  padding: 3px 8px;
}
</style>
