<template>
  <div class="toolbar" role="toolbar" aria-label="Markly 格式与插入工具栏">
    <div class="toolbar-row toolbar-row-primary">
      <!-- 模式切换 -->
      <div class="toolbar-group mode-switch" role="group" aria-label="Editor Mode">
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'rich' }"
          title="Rich Mode (WYSIWYG)"
          aria-label="Rich Mode (WYSIWYG)"
          type="button"
          :tabindex="mode === 'rich' ? 0 : -1"
          @keydown="onModeKeydown"
          @click="switchModeFromToolbar('rich')"
          ref="richBtnRef"
        >
          <span class="btn-icon">T</span>
          <span class="btn-label">Rich</span>
        </button>
        <button
          class="toolbar-btn mode-btn"
          :class="{ active: mode === 'source' }"
          title="Source Mode"
          aria-label="Source Mode"
          type="button"
          :tabindex="mode === 'source' ? 0 : -1"
          @keydown="onModeKeydown"
          @click="switchModeFromToolbar('source')"
          ref="sourceBtnRef"
        >
          <span class="btn-icon">{ }</span>
          <span class="btn-label">Source</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 标题 -->
      <div class="toolbar-group" role="group" aria-label="Headings">
        <button
          v-for="btn in headingButtons"
          :key="btn.id"
          class="toolbar-btn heading-btn"
          :title="btn.label"
          :aria-label="btn.label"
          @mousedown.prevent
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 格式 -->
      <div class="toolbar-group" role="group" aria-label="Format">
        <button
          v-for="btn in formatButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          :aria-label="btn.label"
          @mousedown.prevent
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 列表 -->
      <div class="toolbar-group" role="group" aria-label="Lists">
        <button
          v-for="btn in listButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          :aria-label="btn.label"
          @mousedown.prevent
          @click="$emit('format', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 插入 -->
      <div class="toolbar-group" role="group" aria-label="Insert">
        <button
          v-for="btn in insertButtons"
          :key="btn.id"
          class="toolbar-btn"
          :title="btn.label"
          :aria-label="btn.label"
          @mousedown.prevent
          @click="$emit('insert', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">{{ btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- Rich 表格结构（仅光标在表格内时可用） -->
      <div class="toolbar-group" role="group" aria-label="Table structure">
        <button
          v-for="btn in tableStructureButtons"
          :key="btn.id"
          class="toolbar-btn"
          type="button"
          :title="btn.label"
          :aria-label="btn.label"
          :disabled="props.mode !== 'rich' || !props.richTableActive"
          @mousedown.prevent
          @click="$emit('rich-table-op', btn.id)"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span class="btn-label">表格</span>
        </button>
        <button
          class="toolbar-btn"
          type="button"
          :title="tableHelpTitle"
          :aria-label="tableHelpTitle"
          :disabled="props.mode !== 'rich'"
          @mousedown.prevent
          @click="$emit('rich-table-help')"
        >
          <span class="btn-icon">?</span>
          <span class="btn-label">帮助</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 撤销/重做 -->
      <div class="toolbar-group" role="group" aria-label="History">
        <button
          class="toolbar-btn"
          title="Undo (Ctrl+Z)"
          aria-label="Undo (Ctrl+Z)"
          @mousedown.prevent
          @click="$emit('undo')"
        >
          <span class="btn-icon">&#x21A9;</span>
          <span class="btn-label">撤销</span>
        </button>
        <button
          class="toolbar-btn"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo (Ctrl+Shift+Z)"
          @mousedown.prevent
          @click="$emit('redo')"
        >
          <span class="btn-icon">&#x21AA;</span>
          <span class="btn-label">重做</span>
        </button>
      </div>
    </div>

    <div class="toolbar-row toolbar-row-secondary">
      <!-- 查找 -->
      <div class="toolbar-group" role="group" aria-label="Search">
        <button
          class="toolbar-btn"
          :class="{ active: findPanelOpen }"
          type="button"
          title="查找和替换 (Ctrl+F)"
          aria-label="查找和替换 (Ctrl+F)"
          @mousedown.prevent
          @click="$emit('find-replace')"
        >
          <span class="btn-icon">&#x2315;</span>
          <span class="btn-label">查找</span>
        </button>
      </div>

      <!-- 缩放：图标按钮，点击立即生效 -->
      <div class="toolbar-group zoom-group" role="group" aria-label="Zoom">
        <button
          class="toolbar-btn"
          type="button"
          :title="`缩小（${zoomOutHint}）`"
          :aria-label="`缩小（${zoomOutHint}）`"
          @mousedown.prevent
          @click="emit('zoom-out')"
        >
          <span class="btn-icon">🔍−</span>
          <span class="btn-label">缩小</span>
        </button>
        <button
          class="toolbar-btn zoom-indicator"
          type="button"
          :title="`重置缩放（${zoomResetHint}）`"
          :aria-label="`重置缩放（${zoomResetHint}）`"
          @mousedown.prevent
          @click="emit('zoom-reset')"
        >
          <span class="btn-icon">{{ zoomPercent }}%</span>
          <span class="btn-label">重置</span>
        </button>
        <button
          class="toolbar-btn"
          type="button"
          :title="`放大（${zoomInHint}）`"
          :aria-label="`放大（${zoomInHint}）`"
          @mousedown.prevent
          @click="emit('zoom-in')"
        >
          <span class="btn-icon">🔍＋</span>
          <span class="btn-label">放大</span>
        </button>
      </div>

      <!-- 视图 -->
      <div class="toolbar-group" role="group" aria-label="View">
        <button
          class="toolbar-btn"
          :class="{ active: showOutline }"
          title="Toggle Outline"
          aria-label="Toggle Outline"
          @click="$emit('toggle-outline')"
        >
          <span class="btn-icon">&#x2630;</span>
          <span class="btn-label">大纲</span>
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: showLineNumbers }"
          title="Toggle Line Numbers"
          aria-label="Toggle Line Numbers"
          @click="$emit('toggle-line-numbers')"
        >
          <span class="btn-icon">#</span>
          <span class="btn-label">行号</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 导出 -->
      <div class="toolbar-group" role="group" aria-label="Export">
        <button class="toolbar-btn export-btn" title="Export PDF" aria-label="Export PDF" @click="$emit('export', 'pdf')">
          <span class="btn-icon">&#x1F4C4;</span>
          <span class="btn-label">PDF</span>
        </button>
        <button class="toolbar-btn export-btn" title="Export HTML" aria-label="Export HTML" @click="$emit('export', 'html')">
          <span class="btn-icon">&#x1F310;</span>
          <span class="btn-label">HTML</span>
        </button>
        <button
          class="toolbar-btn export-btn"
          title="Preview export (HTML)"
          aria-label="Preview export (HTML)"
          @click="$emit('export', 'preview')"
        >
          <span class="btn-icon">&#x1F441;&#xFE0F;</span>
          <span class="btn-label">预览</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { EditorMode } from '../../../src/types';

const props = defineProps<{
  mode: EditorMode;
  showOutline?: boolean;
  showLineNumbers?: boolean;
  /** 查找面板是否打开（工具栏高亮） */
  findPanelOpen?: boolean;
  /** 编辑区缩放百分比（展示） */
  zoomPercent?: number;
  /** Rich 下光标是否在表格内 */
  richTableActive?: boolean;
}>();

const emit = defineEmits<{
  (e: 'format', format: string): void;
  (e: 'insert', type: string): void;
  (e: 'switch-mode', mode: EditorMode): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'find-replace'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-reset'): void;
  (e: 'zoom-set', zoom: number): void;
  (e: 'toggle-outline'): void;
  (e: 'toggle-line-numbers'): void;
  (e: 'export', format: 'pdf' | 'html' | 'preview'): void;
  (e: 'rich-table-op', op: string): void;
  (e: 'rich-table-help'): void;
}>();

const headingButtons = [
  { id: 'h1', icon: 'H1', shortLabel: 'H1', label: 'Heading 1' },
  { id: 'h2', icon: 'H2', shortLabel: 'H2', label: 'Heading 2' },
  { id: 'h3', icon: 'H3', shortLabel: 'H3', label: 'Heading 3' },
  { id: 'h4', icon: 'H4', shortLabel: 'H4', label: 'Heading 4' },
];

const richBtnRef = ref<HTMLButtonElement | null>(null);
const sourceBtnRef = ref<HTMLButtonElement | null>(null);

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

const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const modLabel = computed(() => (isMac ? '⌘' : 'Ctrl'));
const tableHelpTitle = 'Rich 表格快捷键说明';

const tableStructureButtons = computed(() => {
  const m = modLabel.value;
  return [
    {
      id: 'addRowBefore',
      icon: '\u2191',
      label: `表格：上方插入行（${m}+⌥+↑）`,
    },
    {
      id: 'addRowAfter',
      icon: '\u2193',
      label: `表格：下方插入行（${m}+⌥+↓）`,
    },
    {
      id: 'addColBefore',
      icon: '\u2190',
      label: `表格：左侧插入列（${m}+⌥+←）`,
    },
    {
      id: 'addColAfter',
      icon: '\u2192',
      label: `表格：右侧插入列（${m}+⌥+→）`,
    },
    {
      id: 'toggleHeaderRow',
      icon: 'H',
      label: '表格：切换表头行',
    },
    {
      id: 'alignLeft',
      icon: 'L',
      label: '表格：当前列左对齐',
    },
    {
      id: 'alignCenter',
      icon: 'C',
      label: '表格：当前列居中',
    },
    {
      id: 'alignRight',
      icon: 'R',
      label: '表格：当前列右对齐',
    },
    {
      id: 'mergeCells',
      icon: '⇔',
      label: '表格：合并单元格',
    },
    {
      id: 'splitCell',
      icon: '⇕',
      label: '表格：拆分单元格',
    },
    {
      id: 'deleteTable',
      icon: '⌧',
      label: '表格：删除当前表格',
    },
    {
      id: 'deleteRow',
      icon: '\u2296',
      label: `表格：删除当前行（${m}+⌥+Backspace）`,
    },
    {
      id: 'deleteCol',
      icon: '\u2297',
      label: `表格：删除当前列（${m}+⌥+Shift+Backspace）`,
    },
  ];
});

const zoomInHint = isMac ? '⌘=' : 'Ctrl+=';
const zoomOutHint = isMac ? '⌘-' : 'Ctrl+-';
const zoomResetHint = isMac ? '⌘0' : 'Ctrl+0';

function onModeKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  // IR 已降级为隐藏 fallback，不再作为主打模式在工具栏暴露
  const order: EditorMode[] = ['rich', 'source'];
  const cur = order.indexOf(props.mode);
  const dir = e.key === 'ArrowRight' ? 1 : -1;
  const next = order[(cur + dir + order.length) % order.length]!;
  switchModeFromToolbar(next, { focus: true });
}

function switchModeFromToolbar(next: EditorMode, opts?: { focus?: boolean }) {
  emit('switch-mode', next);
  if (opts?.focus) {
    // roving tabindex：切换后把焦点移动到当前激活段
    queueMicrotask(() => {
      (next === 'rich' ? richBtnRef.value : sourceBtnRef.value)?.focus();
    });
  }
}

onMounted(() => {});

onUnmounted(() => {});
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: var(--markly-pad-sm) var(--markly-pad-md);
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  gap: 8px;
  overflow-x: hidden;
  min-height: auto;
}

.toolbar-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
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
  height: 40px;
  background: var(--vscode-editorWidget-border);
  margin: 0 6px;
  flex-shrink: 0;
}

/* 基础按钮：增大 20% (32 -> 38) */
.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  width: 44px;
  height: 44px;
  padding: 4px 3px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: var(--markly-radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.15s;
  flex-shrink: 0;
  gap: 2px;
}

.btn-icon {
  font-size: 13px;
  line-height: 1.2;
}

.btn-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.9;
  line-height: 1;
  max-width: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-contrastBorder, transparent);
}

.toolbar-btn:active {
  background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
}

.perf-tier-btn {
  width: auto;
  padding: 0 8px;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
}

.perf-tier-btn:hover {
  color: var(--vscode-foreground);
}

.toolbar-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.toolbar-btn.active .btn-label {
  opacity: 1;
}

.toolbar-btn.active:hover {
  background: var(--vscode-button-hoverBackground);
}

/* Zoom indicator button: make percent fit */
.zoom-group {
  gap: 6px;
}

.zoom-indicator .btn-icon {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

/* Mode switch buttons */
.mode-switch {
  gap: 0;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  border-radius: var(--markly-radius-md);
  overflow: hidden;
}

.mode-btn {
  flex-direction: row;
  min-width: auto;
  width: auto;
  padding: 0 8px;
  gap: 5px;
  border-radius: 0;
}

.mode-btn + .mode-btn {
  border-left: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
}

.mode-switch .mode-btn.active {
  background: var(--vscode-tab-activeBackground, var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground)));
  color: var(--vscode-foreground);
  border-color: transparent;
}

/* focus ring：更像 VS Code 的 focus 边框感 */
.mode-switch:focus-within {
  border-color: var(--vscode-focusBorder, #007acc);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
}

.mode-btn:focus-visible {
  outline: none;
}

/* Heading buttons */
.heading-btn .btn-icon {
  font-size: 14px;
  font-weight: 700;
}

/* Export buttons */
.export-btn {
  min-width: 54px;
  width: 54px;
}
</style>
