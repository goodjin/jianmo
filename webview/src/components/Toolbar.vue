<template>
  <div class="toolbar">
    <!-- 模式切换 -->
    <div class="toolbar-group mode-switch">
      <button
        class="toolbar-btn mode-btn"
        :class="{ active: mode === 'source' }"
        title="Source Mode"
        @click="$emit('toggle-mode')"
      >
        <span class="mode-icon">{ }</span>
        <span class="mode-label">Source</span>
      </button>
      <button
        class="toolbar-btn mode-btn"
        :class="{ active: mode === 'preview' }"
        title="Preview Mode"
        @click="$emit('toggle-mode')"
      >
        <span class="mode-icon">👁</span>
        <span class="mode-label">Preview</span>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <!-- 撤销/重做 -->
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Undo (Ctrl+Z)"
        @click="$emit('undo')"
      >
        ↩
      </button>
      <button
        class="toolbar-btn"
        title="Redo (Ctrl+Y)"
        @click="$emit('redo')"
      >
        ↪
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <!-- 标题 -->
    <div class="toolbar-group">
      <button
        v-for="btn in headingButtons"
        :key="btn.id"
        class="toolbar-btn"
        :title="btn.label"
        @click="$emit('format', btn.id)"
      >
        {{ btn.icon }}
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
        {{ btn.icon }}
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <!-- 列表 -->
    <div class="toolbar-group">
      <button
        v-for="btn in listButtons"
        :key="btn.id"
        class="toolbar-btn"
        :title="btn.label"
        @click="$emit('format', btn.id)"
      >
        {{ btn.icon }}
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
        {{ btn.icon }}
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <!-- 查找替换 -->
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Find and Replace (Ctrl+H)"
        @click="$emit('find-replace')"
      >
        🔍
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <!-- 快捷键提示 -->
    <div class="toolbar-hint">
      <kbd>Cmd + \\</kbd> Toggle Mode
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorMode } from '../../../src/types';

defineProps<{
  mode: EditorMode;
}>();

defineEmits<{
  (e: 'format', format: string): void;
  (e: 'insert', type: string): void;
  (e: 'toggle-mode'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'find-replace'): void;
}>();

const headingButtons = [
  { id: 'h1', icon: 'H1', label: 'Heading 1' },
  { id: 'h2', icon: 'H2', label: 'Heading 2' },
  { id: 'h3', icon: 'H3', label: 'Heading 3' },
  { id: 'h4', icon: 'H4', label: 'Heading 4' },
  { id: 'h5', icon: 'H5', label: 'Heading 5' },
  { id: 'h6', icon: 'H6', label: 'Heading 6' },
];

const formatButtons = [
  { id: 'bold', icon: 'B', label: 'Bold' },
  { id: 'italic', icon: 'I', label: 'Italic' },
  { id: 'strike', icon: 'S', label: 'Strikethrough' },
  { id: 'code', icon: '</>', label: 'Inline Code' },
  { id: 'highlight', icon: '🖍', label: 'Highlight' },
  { id: 'subscript', icon: 'X₂', label: 'Subscript' },
  { id: 'superscript', icon: 'X²', label: 'Superscript' },
  { id: 'clearFormat', icon: '✕', label: 'Clear Format' },
];

const listButtons = [
  { id: 'bulletList', icon: '•', label: 'Bullet List' },
  { id: 'orderedList', icon: '1.', label: 'Ordered List' },
  { id: 'taskList', icon: '☐', label: 'Task List' },
  { id: 'quote', icon: '"', label: 'Quote' },
  { id: 'indent', icon: '→', label: 'Indent' },
  { id: 'outdent', icon: '←', label: 'Outdent' },
];

const insertButtons = [
  { id: 'link', icon: '🔗', label: 'Link' },
  { id: 'image', icon: '🖼', label: 'Image' },
  { id: 'codeBlock', icon: '{ }', label: 'Code Block' },
  { id: 'table', icon: '⊞', label: 'Table' },
  { id: 'hr', icon: '—', label: 'Horizontal Rule' },
  { id: 'math', icon: '∑', label: 'Math Formula' },
];
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  padding: 12px 18px;
  background: var(--vscode-editorWidget-background);
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  gap: 6px;
  overflow-x: auto;
  min-height: 66px;
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
  height: 30px;
  background: var(--vscode-editorWidget-border);
  margin: 0 9px;
  flex-shrink: 0;
}

.toolbar-spacer {
  flex: 1;
  min-width: 20px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  width: 42px;
  height: 42px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: background-color 0.15s;
  flex-shrink: 0;
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
  padding: 6px 12px;
  gap: 4px;
}

.mode-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.mode-btn.active:hover {
  background: var(--vscode-button-hoverBackground);
}

.mode-icon {
  font-size: 18px;
}

.mode-label {
  font-size: 15px;
  font-weight: 500;
}

.toolbar-hint {
  font-size: 15px;
  color: var(--vscode-descriptionForeground);
  margin-left: 12px;
  flex-shrink: 0;
  white-space: nowrap;
}

.toolbar-hint kbd {
  background: var(--vscode-keybindingLabel-background);
  border: 1px solid var(--vscode-keybindingLabel-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: var(--vscode-editor-font-family);
  font-size: 13px;
}
</style>
