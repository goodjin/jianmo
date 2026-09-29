<template>
  <div class="settings-page">
    <div class="settings-inner">
      <h2 class="settings-heading">设置</h2>

      <section class="settings-section" aria-labelledby="settings-appearance">
        <h3 id="settings-appearance" class="section-title">外观</h3>

        <div class="field">
          <div class="field-label">主题</div>
          <p class="field-hint">选择后立即生效，并记住到下次打开。</p>
          <div class="theme-grid" role="listbox" aria-label="主题">
            <button
              v-for="palette in palettes"
              :key="palette.id"
              type="button"
              class="theme-card"
              :class="{ selected: palette.id === selectedPaletteId }"
              role="option"
              :aria-selected="palette.id === selectedPaletteId"
              :title="palette.name"
              @click="$emit('update', { theme: palette.id })"
            >
              <span
                class="theme-swatch"
                :style="{ background: palette.colors.background, borderColor: palette.colors.border }"
              >
                <span class="swatch-bar" :style="{ background: palette.colors.surface }"></span>
                <span class="swatch-bar" :style="{ background: palette.colors.primary }"></span>
                <span class="swatch-bar" :style="{ background: palette.colors.text }"></span>
              </span>
              <span class="theme-name">{{ palette.name }}</span>
            </button>
          </div>
          <label class="auto-row">
            <input
              type="checkbox"
              :checked="appearance.theme === 'auto'"
              @change="onToggleAuto(($event.target as HTMLInputElement).checked)"
            />
            <span>跟随系统明暗（当前系统为{{ appearance.prefersDark ? '深色' : '浅色' }}）</span>
          </label>
        </div>

        <div class="field">
          <label class="field-label" for="settings-font-family">文字字体</label>
          <select
            id="settings-font-family"
            class="field-control"
            :value="appearance.fontFamily"
            @change="$emit('update', { fontFamily: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="opt in fontFamilies" :key="opt.id" :value="opt.stack">{{ opt.name }}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="settings-font-size">文字大小</label>
          <select
            id="settings-font-size"
            class="field-control"
            :value="String(appearance.fontSize)"
            @change="$emit('update', { fontSize: Number(($event.target as HTMLSelectElement).value) })"
          >
            <option v-for="size in fontSizes" :key="size" :value="String(size)">{{ size }} px</option>
          </select>
        </div>

        <div class="field">
          <div class="field-label">预览效果</div>
          <p
            class="sample"
            :style="{ fontFamily: appearance.fontFamily || undefined, fontSize: appearance.fontSize + 'px' }"
          >
            The quick brown fox jumps over the lazy dog. 这是一段中文示例文字。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EDITOR_PALETTES } from '@wv/shared/themeConfig';
import { resolveEditorPaletteId } from '@types';
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from '../electron/appearance';
import type { AppearanceState } from './electronBridge';

const props = defineProps<{ appearance: AppearanceState }>();

const emit = defineEmits<{
  (e: 'update', patch: Partial<AppearanceState>): void;
}>();

const palettes = EDITOR_PALETTES;
const fontFamilies = FONT_FAMILY_OPTIONS;
const fontSizes = FONT_SIZE_OPTIONS;

/** auto 时高亮的是系统明暗解析出来的那套配色。 */
const selectedPaletteId = computed(() =>
  resolveEditorPaletteId(props.appearance.theme, props.appearance.prefersDark)
);

/** 勾选回 auto；取消勾选则把当前实际生效的配色固定下来。 */
function onToggleAuto(checked: boolean): void {
  emit('update', { theme: checked ? 'auto' : selectedPaletteId.value });
}
</script>

<style scoped>
.settings-page {
  height: 100%;
  overflow-y: auto;
  background: var(--markly-background, #fff);
  color: var(--markly-text, #1f2328);
}
.settings-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}
.settings-heading {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 650;
}
.settings-section {
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 10px;
  padding: 18px 20px 8px;
  background: var(--markly-surface, #f6f8fa);
}
.section-title {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 650;
}
.field { margin-bottom: 22px; }
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.field-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--markly-textSecondary, #57606a);
}
.field-control {
  width: 100%;
  max-width: 320px;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  color: inherit;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}
.theme-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 8px;
  background: var(--markly-background, #fff);
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.theme-card:hover { border-color: var(--markly-primary, #0969da); }
.theme-card.selected {
  border-color: var(--markly-primary, #0969da);
  box-shadow: 0 0 0 1px var(--markly-primary, #0969da);
}
.theme-swatch {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  height: 46px;
  padding: 6px 8px;
  border: 1px solid;
  border-radius: 6px;
}
.swatch-bar {
  height: 5px;
  border-radius: 3px;
}
.swatch-bar:nth-child(1) { width: 100%; }
.swatch-bar:nth-child(2) { width: 62%; }
.swatch-bar:nth-child(3) { width: 80%; }
.theme-name {
  font-size: 12px;
  line-height: 1.3;
}
.auto-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--markly-textSecondary, #57606a);
  cursor: pointer;
}
.sample {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 8px;
  background: var(--markly-background, #fff);
  line-height: 1.7;
}
</style>
