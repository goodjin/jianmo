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
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EditorPaletteId, EditorThemeSetting } from '../../../src/types';
import { resolveEditorPaletteId } from '../../../src/types';
import { EDITOR_PALETTES } from '../shared/themeConfig';

const props = defineProps<{
  theme: EditorThemeSetting | string;
  prefersDark: boolean;
}>();

defineEmits<{
  (e: 'select-theme', theme: EditorPaletteId): void;
  (e: 'close'): void;
}>();

const palettes = EDITOR_PALETTES;

const selectedPaletteId = computed(() => resolveEditorPaletteId(props.theme, props.prefersDark));
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
</style>
