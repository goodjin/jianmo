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
          <div class="field-label" id="settings-font-family-label">正文字体</div>
          <p class="field-hint">预览里的正文用这里选的字体，改完马上生效，并记住到下次打开。列表里是这台电脑已安装的字体，思源黑体随应用自带。按钮、菜单和文件树仍用系统字体。</p>
          <div ref="fontPickerRef" class="font-picker">
            <button
              id="settings-font-family"
              type="button"
              class="field-control font-picker-button"
              aria-haspopup="listbox"
              :aria-expanded="fontOpen"
              aria-controls="settings-font-family-list"
              @click="fontOpen = !fontOpen"
            >
              <span class="font-picker-value">{{ selectedFontName }}</span>
              <span class="font-picker-caret" aria-hidden="true">▾</span>
            </button>
            <ul
              v-if="fontOpen"
              id="settings-font-family-list"
              ref="fontMenuRef"
              class="font-menu"
              role="listbox"
              aria-labelledby="settings-font-family-label"
            >
              <li v-for="opt in fontOptions" :key="opt.id" role="presentation">
                <button
                  type="button"
                  class="font-option"
                  role="option"
                  :aria-selected="appearance.fontFamily === opt.stack"
                  :class="{ selected: appearance.fontFamily === opt.stack }"
                  @click="chooseFont(opt.stack)"
                >{{ opt.name }}</button>
              </li>
            </ul>
          </div>
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
            :style="{ fontFamily: appearance.fontFamily || systemFontStack, fontSize: appearance.fontSize + 'px' }"
          >
            The quick brown fox jumps over the lazy dog. 这是一段中文示例文字。<strong>粗体</strong>
          </p>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-reading">
        <h3 id="settings-reading" class="section-title">阅读</h3>
        <div class="field">
          <label class="auto-row copy-on-select-row" for="settings-copy-on-select">
            <input
              id="settings-copy-on-select"
              type="checkbox"
              :checked="copyOnSelect"
              @change="onToggleCopyOnSelect(($event.target as HTMLInputElement).checked)"
            />
            <span>选择即复制</span>
          </label>
          <p class="field-hint">在预览里选中文字后自动放进剪贴板。关掉后，仍可以用顶栏复制或快捷键。</p>
        </div>
        <div class="field">
          <label class="auto-row copy-on-select-row" for="settings-word-wrap">
            <input
              id="settings-word-wrap"
              type="checkbox"
              :checked="wordWrap"
              @change="onToggleWordWrap(($event.target as HTMLInputElement).checked)"
            />
            <span>自动换行</span>
          </label>
          <p class="field-hint">勾选后，太长的文字会自动折到下一行，正文下面不再出现左右滚动条。取消后，长行保持一行，只在正文里面左右滚动。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { EDITOR_PALETTES } from '@wv/shared/themeConfig';
import { resolveEditorPaletteId } from '@types';
import { FONT_SIZE_OPTIONS, SYSTEM_FONT_STACK, readingFontOptions } from '../electron/appearance';
import type { AppearanceState } from './electronBridge';

const props = withDefaults(
  defineProps<{
    appearance: AppearanceState;
    systemFonts?: string[];
    copyOnSelect?: boolean;
    wordWrap?: boolean;
  }>(),
  { systemFonts: () => [], copyOnSelect: true, wordWrap: true }
);

const emit = defineEmits<{
  (e: 'update', patch: Partial<AppearanceState>): void;
  (e: 'updateReader', patch: { copyOnSelect?: boolean; wordWrap?: boolean }): void;
}>();

const palettes = EDITOR_PALETTES;
const fontSizes = FONT_SIZE_OPTIONS;
const systemFontStack = SYSTEM_FONT_STACK;
const fontOpen = ref(false);
const fontPickerRef = ref<HTMLElement | null>(null);
const fontMenuRef = ref<HTMLElement | null>(null);
const fontOptions = computed(() => readingFontOptions(props.systemFonts));
const selectedFontName = computed(
  () => fontOptions.value.find((opt) => opt.stack === props.appearance.fontFamily)?.name ?? '思源黑体'
);

function chooseFont(stack: string): void {
  fontOpen.value = false;
  emit('update', { fontFamily: stack });
}

function onFontPointerDown(ev: PointerEvent): void {
  if (!fontOpen.value) return;
  const root = fontPickerRef.value;
  if (root && ev.target instanceof Node && root.contains(ev.target)) return;
  fontOpen.value = false;
}

function onFontKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') fontOpen.value = false;
}

watch(fontOpen, async (open) => {
  if (!open) return;
  await nextTick();
  const selected = fontMenuRef.value?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (typeof selected?.scrollIntoView === 'function') selected.scrollIntoView({ block: 'nearest' });
});

onMounted(() => {
  document.addEventListener('pointerdown', onFontPointerDown, true);
  document.addEventListener('keydown', onFontKeydown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onFontPointerDown, true);
  document.removeEventListener('keydown', onFontKeydown);
});

/** auto 时高亮的是系统明暗解析出来的那套配色。 */
const selectedPaletteId = computed(() =>
  resolveEditorPaletteId(props.appearance.theme, props.appearance.prefersDark)
);

/** 勾选回 auto；取消勾选则把当前实际生效的配色固定下来。 */
function onToggleAuto(checked: boolean): void {
  emit('update', { theme: checked ? 'auto' : selectedPaletteId.value });
}

function onToggleCopyOnSelect(checked: boolean): void {
  emit('updateReader', { copyOnSelect: checked });
}

function onToggleWordWrap(checked: boolean): void {
  emit('updateReader', { wordWrap: checked });
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
  border-radius: var(--app-radius-lg);
  padding: 18px 20px 8px;
  background: var(--markly-surface, #f6f8fa);
}
.settings-section + .settings-section { margin-top: 16px; }
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
  border-radius: var(--app-radius-sm);
  background: var(--markly-background, #fff);
  color: inherit;
}
.font-picker {
  position: relative;
  max-width: 320px;
}
.font-picker-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  max-width: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.font-picker-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.font-picker-caret {
  flex: 0 0 auto;
  color: var(--markly-textSecondary, #57606a);
}
.font-menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-md);
  background: var(--markly-background, #fff);
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12);
}
.font-option {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.font-option:hover { background: var(--markly-surfaceHover, #eaeef2); }
.font-option.selected {
  background: color-mix(in srgb, var(--markly-primary, #0969da) 16%, transparent);
  font-weight: 650;
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
  border-radius: var(--app-radius-md);
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
  border-radius: var(--app-radius-sm);
}
.swatch-bar {
  height: 5px;
  border-radius: var(--app-radius-pill);
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
.copy-on-select-row {
  margin-top: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--markly-text, #1f2328);
}
.sample {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-md);
  background: var(--markly-background, #fff);
  line-height: 1.7;
}
</style>
