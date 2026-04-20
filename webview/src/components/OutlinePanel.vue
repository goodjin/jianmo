<template>
  <div class="outline-panel" v-if="outline.length > 0">
    <div class="outline-header">
      <span class="outline-title">大纲</span>
    </div>
    <div class="outline-list">
      <button
        v-for="item in outline"
        :key="item.id"
        class="outline-item"
        :class="{ active: item.id === activeHeadingId }"
        :style="{ paddingLeft: (item.level - 1) * 12 + 8 + 'px' }"
        type="button"
        :aria-current="item.id === activeHeadingId ? 'true' : undefined"
        @click="handleClick(item)"
      >
        {{ item.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import type { EditorMode } from '../../src/types';

interface OutlineItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

const props = defineProps<{
  content: string;
  currentMode: EditorMode;
}>();

const emit = defineEmits<{
  (e: 'jump', pos: number, headingId: string): void;
}>();

const outline = ref<OutlineItem[]>([]);
const activeHeadingId = ref<string>('');
const OUTLINE_PARSE_DEBOUNCE_MS = 250;
let parseTimer: ReturnType<typeof setTimeout> | null = null;
let hasParsedOnce = false;

// 生成标题 ID（与 MilkdownEditor 保持一致）
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '') // 移除特殊字符，保留中文
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并
    .replace(/^-|-$/g, ''); // 移除首尾连字符
}

// 解析内容生成大纲
function parseOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = content.split('\n');
  let pos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 ATX 标题: # ## ### #### ##### ######
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // 移除已有的 ID 锚点
      const cleanText = text.replace(/\{#[^}]+\}$/, '').trim();
      items.push({
        id: generateHeadingId(cleanText),
        level,
        text: cleanText,
        pos,
      });
    }
    pos += line.length + 1; // +1 for newline
  }

  return items;
}

// 监听内容变化，更新大纲
watch(
  () => props.content,
  (newContent) => {
    // 首次渲染保持立即解析，后续 content 变更使用 debounce（连续输入取消上一次）
    if (!hasParsedOnce) {
      hasParsedOnce = true;
      outline.value = parseOutline(newContent);
      return;
    }

    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }
    parseTimer = setTimeout(() => {
      outline.value = parseOutline(newContent);
      parseTimer = null;
    }, OUTLINE_PARSE_DEBOUNCE_MS);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (parseTimer) {
    clearTimeout(parseTimer);
    parseTimer = null;
  }
});

function handleClick(item: OutlineItem) {
  activeHeadingId.value = item.id;
  emit('jump', item.pos, item.id);
}

const currentMode = computed(() => props.currentMode);
</script>

<style scoped>
.outline-panel {
  width: 200px;
  min-width: 200px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border-left: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.outline-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
}

.outline-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.outline-item {
  padding: 6px 8px;
  margin: 2px 8px;
  font-size: 13px;
  color: var(--vscode-foreground);
  cursor: pointer;
  border-radius: var(--markly-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  width: calc(100% - 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s;
}

.outline-item:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.outline-item.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>
