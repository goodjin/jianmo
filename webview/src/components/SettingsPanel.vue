<template>
  <section
    class="markly-settings-panel"
    role="region"
    aria-label="编辑器设置"
  >
    <div class="markly-settings-head">
      <h3 class="markly-settings-title">设置</h3>
      <button
        type="button"
        class="markly-settings-close"
        aria-label="关闭设置"
        @click="$emit('close')"
      >
        关闭
      </button>
    </div>

    <div class="markly-settings-section">
      <div class="markly-settings-section-title" id="markly-theme-label">主题</div>
      <p class="markly-settings-hint">选择后立即生效，并记住到下次打开。</p>
      <div class="markly-theme-grid" role="listbox" aria-labelledby="markly-theme-label">
        <button
          v-for="palette in palettes"
          :key="palette.id"
          type="button"
          class="markly-theme-card"
          :class="{ selected: palette.id === selectedPaletteId }"
          role="option"
          :aria-selected="palette.id === selectedPaletteId"
          :title="palette.name"
          @click="$emit('select-theme', palette.id)"
        >
          <span
            class="markly-theme-swatch"
            :style="{
              background: palette.colors.background,
              borderColor: palette.colors.border,
            }"
          >
            <span class="markly-theme-swatch-bar" :style="{ background: palette.colors.surface }"></span>
            <span class="markly-theme-swatch-bar" :style="{ background: palette.colors.primary }"></span>
            <span class="markly-theme-swatch-bar" :style="{ background: palette.colors.text }"></span>
          </span>
          <span class="markly-theme-name">{{ palette.name }}</span>
        </button>
      </div>
    </div>

    <div class="markly-settings-section markly-toolbar-settings">
      <div class="markly-settings-section-title" id="markly-toolbar-label">工具栏</div>
      <p class="markly-settings-hint">字号和按钮显隐会记住，下次打开仍然有效。没勾选的按钮会从工具栏拿掉。</p>
      <label class="markly-toolbar-font">
        <span>字体大小</span>
        <select
          :value="String(fontSize)"
          aria-labelledby="markly-toolbar-label"
          @change="onFontSizeChange"
        >
          <option v-for="size in fontSizeOptions" :key="size" :value="String(size)">{{ size }} px</option>
        </select>
      </label>
      <div class="markly-toolbar-button-head">
        <span>显示的按钮</span>
        <button type="button" class="markly-settings-close" @click="$emit('reset-toolbar-buttons')">全部显示</button>
      </div>
      <div class="markly-toolbar-groups">
        <div v-for="group in groupedButtons" :key="group.id" class="markly-toolbar-group">
          <div class="markly-toolbar-group-title">{{ group.label }}</div>
          <label v-for="item in group.items" :key="item.id" class="markly-toolbar-check">
            <input
              type="checkbox"
              :checked="isShown(item.id)"
              @change="onToggleButton(item.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ item.settingsLabel }}</span>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EditorPaletteId, EditorThemeSetting, ToolbarButtonId } from '../../../src/types';
import { resolveEditorPaletteId } from '../../../src/types';
import {
  TOOLBAR_BUTTON_CATALOG,
  TOOLBAR_FONT_SIZE_MAX,
  TOOLBAR_FONT_SIZE_MIN,
  TOOLBAR_GROUP_LABELS,
  TOOLBAR_GROUP_ORDER,
  isToolbarButtonShown,
  normalizeToolbarFontSize,
} from '../../../src/types/toolbarPrefs';
import { EDITOR_PALETTES } from '../shared/themeConfig';

const props = defineProps<{
  theme: EditorThemeSetting | string;
  prefersDark: boolean;
  toolbarFontSize?: number;
  toolbarButtons?: Partial<Record<ToolbarButtonId, boolean>>;
}>();

const emit = defineEmits<{
  (e: 'select-theme', theme: EditorPaletteId): void;
  (e: 'update-toolbar-font-size', fontSize: number): void;
  (e: 'toggle-toolbar-button', id: ToolbarButtonId, visible: boolean): void;
  (e: 'reset-toolbar-buttons'): void;
  (e: 'close'): void;
}>();

const palettes = EDITOR_PALETTES;

const selectedPaletteId = computed(() => resolveEditorPaletteId(props.theme, props.prefersDark));

const fontSize = computed(() => normalizeToolbarFontSize(props.toolbarFontSize));

const fontSizeOptions = Array.from(
  { length: TOOLBAR_FONT_SIZE_MAX - TOOLBAR_FONT_SIZE_MIN + 1 },
  (_, i) => TOOLBAR_FONT_SIZE_MIN + i
);

const groupedButtons = TOOLBAR_GROUP_ORDER.map((id) => ({
  id,
  label: TOOLBAR_GROUP_LABELS[id],
  items: TOOLBAR_BUTTON_CATALOG.filter((item) => item.group === id),
}));

function isShown(id: ToolbarButtonId): boolean {
  return isToolbarButtonShown(props.toolbarButtons, id);
}

function onFontSizeChange(event: Event): void {
  const raw = Number((event.target as HTMLSelectElement).value);
  emit('update-toolbar-font-size', normalizeToolbarFontSize(raw));
}

function onToggleButton(id: ToolbarButtonId, visible: boolean): void {
  emit('toggle-toolbar-button', id, visible);
}
</script>

<style scoped>
.markly-settings-panel {
  flex: 0 0 auto;
  padding: 12px 16px 16px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  color: var(--vscode-editor-foreground);
}

.markly-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.markly-settings-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}

.markly-settings-close {
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}

.markly-settings-close:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(90, 90, 90, 0.2));
}

.markly-settings-section-title {
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 4px;
}

.markly-settings-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #888);
}

.markly-theme-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.markly-theme-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.markly-theme-card:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(90, 90, 90, 0.18));
}

.markly-theme-card.selected {
  border-color: var(--vscode-focusBorder, #007acc);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
}

.markly-theme-swatch {
  display: flex;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid transparent;
}

.markly-theme-swatch-bar {
  flex: 1;
}

.markly-theme-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

@media (max-width: 720px) {
  .markly-theme-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.markly-toolbar-settings {
  margin-top: 14px;
}

.markly-toolbar-font {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 10px;
}

.markly-toolbar-font select {
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  background: var(--vscode-input-background, transparent);
  color: inherit;
  padding: 0 6px;
}

.markly-toolbar-button-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 8px;
}

.markly-toolbar-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.markly-toolbar-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.markly-toolbar-group-title {
  flex: 1 0 100%;
  font-size: 11px;
  font-weight: 650;
  color: var(--vscode-descriptionForeground, #888);
  margin-bottom: 2px;
}

.markly-toolbar-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  min-width: 92px;
  cursor: pointer;
}
</style>
