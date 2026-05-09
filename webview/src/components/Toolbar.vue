<template>
  <div class="toolbar" role="toolbar" aria-label="Markly 格式与插入工具栏">
    <div class="toolbar-row toolbar-row-primary">
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
          <span class="btn-label">{{ btn.displayLabel || btn.shortLabel }}</span>
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
          <span class="btn-label">{{ btn.displayLabel || btn.shortLabel }}</span>
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
          <span class="btn-label">{{ btn.displayLabel || btn.shortLabel }}</span>
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
          <span class="btn-label">{{ btn.displayLabel || btn.shortLabel }}</span>
        </button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- 表格：主按钮 + 下拉 -->
      <div class="toolbar-group table-dropdown" role="group" aria-label="Table">
        <button
          class="toolbar-btn"
          type="button"
          title="Table"
          aria-label="Table"
          @mousedown.prevent
          @click="$emit('insert', 'table')"
        >
          <span class="btn-icon">⊞</span>
          <span class="btn-label">表格</span>
        </button>
        <button
          ref="tableMenuBtnRef"
          class="toolbar-btn toolbar-btn-mini"
          type="button"
          :title="tableMenuOpen ? '关闭表格菜单' : '打开表格菜单'"
          :aria-label="tableMenuOpen ? '关闭表格菜单' : '打开表格菜单'"
          @mousedown.prevent
          @click="toggleTableMenu()"
        >
          <span class="btn-icon">▾</span>
          <span class="btn-label">更多</span>
        </button>

        <div
          v-if="tableMenuOpen"
          ref="tableMenuRef"
          class="table-menu"
          role="menu"
          aria-label="表格操作菜单"
        >
          <div class="table-menu-section">
            <div class="table-menu-title">插入（支持数量）</div>
            <div class="table-menu-row">
              <label class="table-menu-input">
                行
                <input v-model="rowCountText" inputmode="numeric" pattern="[0-9]*" />
              </label>
              <button
                class="table-menu-btn"
                :disabled="props.mode !== 'rich' || !props.richTableActive"
                @click="emitTableOpN('addRowBefore', rowCount)"
              >
                上方插入行
              </button>
              <button
                class="table-menu-btn"
                :disabled="props.mode !== 'rich' || !props.richTableActive"
                @click="emitTableOpN('addRowAfter', rowCount)"
              >
                下方插入行
              </button>
            </div>
            <div class="table-menu-row">
              <label class="table-menu-input">
                列
                <input v-model="colCountText" inputmode="numeric" pattern="[0-9]*" />
              </label>
              <button
                class="table-menu-btn"
                :disabled="props.mode !== 'rich' || !props.richTableActive"
                @click="emitTableOpN('addColBefore', colCount)"
              >
                左侧插入列
              </button>
              <button
                class="table-menu-btn"
                :disabled="props.mode !== 'rich' || !props.richTableActive"
                @click="emitTableOpN('addColAfter', colCount)"
              >
                右侧插入列
              </button>
            </div>
          </div>

          <div class="table-menu-sep"></div>

          <div class="table-menu-section">
            <div class="table-menu-title">结构</div>
            <div class="table-menu-row">
              <button class="table-menu-btn" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','toggleHeaderRow')">切换表头行</button>
              <button class="table-menu-btn" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','mergeCells')">合并单元格</button>
              <button class="table-menu-btn" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','splitCell')">拆分单元格</button>
            </div>
          </div>

          <div class="table-menu-sep"></div>

          <div class="table-menu-section">
            <div class="table-menu-title">删除</div>
            <div class="table-menu-row">
              <button class="table-menu-btn danger" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','deleteRow')">删除当前行</button>
              <button class="table-menu-btn danger" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','deleteCol')">删除当前列</button>
              <button class="table-menu-btn danger" :disabled="props.mode !== 'rich' || !props.richTableActive" @click="$emit('rich-table-op','deleteTable')">删除当前表格</button>
            </div>
          </div>

          <div class="table-menu-sep"></div>

          <div class="table-menu-section">
            <button class="table-menu-btn" :disabled="props.mode !== 'rich'" @click="$emit('rich-table-help')">帮助 / 快捷键</button>
          </div>
        </div>
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
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'find-replace'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-reset'): void;
  (e: 'zoom-set', zoom: number): void;
  (e: 'toggle-outline'): void;
  (e: 'toggle-line-numbers'): void;
  (e: 'export', format: 'pdf' | 'html'): void;
  (e: 'rich-table-op', op: string): void;
  (e: 'rich-table-help'): void;
}>();

const headingButtons = [
  { id: 'h1', icon: 'H1', shortLabel: 'H1', displayLabel: '标题1', label: 'Heading 1' },
  { id: 'h2', icon: 'H2', shortLabel: 'H2', displayLabel: '标题2', label: 'Heading 2' },
  { id: 'h3', icon: 'H3', shortLabel: 'H3', displayLabel: '标题3', label: 'Heading 3' },
  { id: 'h4', icon: 'H4', shortLabel: 'H4', displayLabel: '标题4', label: 'Heading 4' },
];

const formatButtons = [
  { id: 'bold', icon: 'B', shortLabel: 'Bold', displayLabel: '加粗', label: 'Bold' },
  { id: 'italic', icon: 'I', shortLabel: 'Italic', displayLabel: '斜体', label: 'Italic' },
  { id: 'strike', icon: 'S', shortLabel: 'Strike', displayLabel: '删除线', label: 'Strikethrough' },
  { id: 'code', icon: '</>', shortLabel: 'Code', displayLabel: '行内代码', label: 'Inline Code' },
  { id: 'clear', icon: 'T', shortLabel: 'Normal', displayLabel: '清除', label: 'Clear Format' },
];

const listButtons = [
  { id: 'bulletList', icon: '\u2022', shortLabel: 'List', displayLabel: '无序', label: 'Bullet List' },
  { id: 'orderedList', icon: '1.', shortLabel: 'Num', displayLabel: '有序', label: 'Ordered List' },
  { id: 'taskList', icon: '\u2610', shortLabel: 'Task', displayLabel: '任务', label: 'Task List' },
  { id: 'quote', icon: '\u201C', shortLabel: 'Quote', displayLabel: '引用', label: 'Quote' },
];

const insertButtons = [
  { id: 'link', icon: '\uD83D\uDD17', shortLabel: 'Link', displayLabel: '链接', label: 'Link' },
  { id: 'image', icon: '\uD83D\uDDBC', shortLabel: 'Image', displayLabel: '图片', label: 'Image' },
  { id: 'codeBlock', icon: '{ }', shortLabel: 'Block', displayLabel: '代码块', label: 'Code Block' },
  { id: 'hr', icon: '\u2014', shortLabel: 'Line', displayLabel: '分割线', label: 'Horizontal Rule' },
  { id: 'math', icon: '\u2211', shortLabel: 'Math', displayLabel: '公式', label: 'Math Formula' },
];

const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const tableHelpTitle = 'Rich 表格快捷键说明';

const tableMenuOpen = ref(false);
const tableMenuBtnRef = ref<HTMLButtonElement | null>(null);
const tableMenuRef = ref<HTMLDivElement | null>(null);
const rowCountText = ref('1');
const colCountText = ref('1');

const rowCount = computed(() => {
  const n = Math.max(1, Math.min(99, Number.parseInt(String(rowCountText.value || '1'), 10) || 1));
  return n;
});
const colCount = computed(() => {
  const n = Math.max(1, Math.min(99, Number.parseInt(String(colCountText.value || '1'), 10) || 1));
  return n;
});

function toggleTableMenu(): void {
  tableMenuOpen.value = !tableMenuOpen.value;
}

function closeTableMenu(): void {
  tableMenuOpen.value = false;
}

function emitTableOpN(op: string, count: number): void {
  const n = Math.max(1, Math.min(99, Number(count) || 1));
  for (let i = 0; i < n; i++) emit('rich-table-op', op);
}

function onWindowPointerDown(e: PointerEvent): void {
  if (!tableMenuOpen.value) return;
  const t = e.target as Node | null;
  if (!t) return;
  if (tableMenuRef.value?.contains(t)) return;
  if (tableMenuBtnRef.value?.contains(t)) return;
  closeTableMenu();
}

function onWindowKeyDown(e: KeyboardEvent): void {
  if (!tableMenuOpen.value) return;
  if (e.key === 'Escape') closeTableMenu();
}

const zoomInHint = isMac ? '⌘=' : 'Ctrl+=';
const zoomOutHint = isMac ? '⌘-' : 'Ctrl+-';
const zoomResetHint = isMac ? '⌘0' : 'Ctrl+0';

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('keydown', onWindowKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown, true);
  window.removeEventListener('keydown', onWindowKeyDown);
});
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
  /* 必须高于 .editor-main：否则下拉菜单会被后同级编辑区盖住；勿用 overflow-x:hidden 裁切菜单 */
  position: relative;
  z-index: 25000;
  overflow: visible;
  min-height: auto;
}

.toolbar-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  max-width: 100%;
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

.toolbar-btn-mini {
  min-width: 44px;
  width: 44px;
}

.table-dropdown {
  position: relative;
}

.table-menu {
  position: absolute;
  top: 54px;
  left: 0;
  z-index: 9999;
  min-width: 320px;
  max-width: 420px;
  padding: 10px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: var(--vscode-editorWidget-background, #252526);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}

.table-menu-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-menu-title {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.9;
}

.table-menu-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.table-menu-input {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.9;
}

.table-menu-input input {
  width: 52px;
  height: 26px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: var(--vscode-input-background, rgba(0, 0, 0, 0.15));
  color: var(--vscode-foreground);
}

.table-menu-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.table-menu-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(90, 90, 90, 0.5));
}

.table-menu-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.table-menu-btn.danger {
  color: var(--vscode-errorForeground, #f48771);
}

.table-menu-sep {
  height: 1px;
  background: var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  margin: 10px 0;
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
