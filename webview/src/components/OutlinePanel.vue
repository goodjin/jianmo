<template>
  <div
    v-if="outline.length > 0"
    class="outline-panel"
    role="region"
    aria-label="文档大纲"
  >
    <div class="outline-header">
      <span class="outline-title">大纲</span>
    </div>
    <div class="outline-list">
      <div
        v-for="item in visibleOutline"
        :key="`${item.id}:${item.pos}`"
        class="outline-row"
        :style="{ paddingLeft: (item.level - 1) * 12 + 4 + 'px' }"
      >
        <button
          v-if="item.hasChildren"
          class="outline-collapse"
          type="button"
          :title="item.collapsed ? '展开小节' : '折叠小节'"
          :aria-label="item.collapsed ? `展开 ${item.text}` : `折叠 ${item.text}`"
          @click.stop="toggleCollapse(item)"
        >
          {{ item.collapsed ? '▸' : '▾' }}
        </button>
        <span v-else class="outline-collapse-placeholder" aria-hidden="true"></span>
        <button
        class="outline-item"
        :class="{ active: item.id === activeHeadingId }"
        type="button"
        :title="item.text"
        :aria-current="item.id === activeHeadingId ? 'true' : undefined"
        @click="handleClick(item)"
      >
        {{ item.text }}
      </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import type { EditorMode } from '../../src/types';
import { generateHeadingId, parseHeadings } from '../shared/outline';

interface OutlineItem {
  id: string;
  level: number;
  text: string;
  pos: number;
  collapsed: boolean;
  hasChildren: boolean;
}

const props = defineProps<{
  content: string;
  currentMode: EditorMode;
  /** 当前章节高亮（scroll spy / 跳转由父组件更新） */
  activeHeadingId: string;
  /** 折叠节点 id 列表（与 vscode webview state 同步由父组件负责） */
  collapsedHeadingIds: string[];
}>();

const emit = defineEmits<{
  (e: 'jump', pos: number, headingId: string): void;
  (e: 'update:collapsedHeadingIds', ids: string[]): void;
}>();

const outline = ref<OutlineItem[]>([]);
const OUTLINE_PARSE_DEBOUNCE_MS = 250;
let parseTimer: ReturnType<typeof setTimeout> | null = null;
let hasParsedOnce = false;

// 解析内容生成大纲
function parseOutline(content: string): OutlineItem[] {
  const headings = parseHeadings(content);
  return headings.map((heading, index) => {
    let hasChildren = false;
    for (const next of headings.slice(index + 1)) {
      if (next.level <= heading.level) break;
      hasChildren = true;
      break;
    }
    const id = generateHeadingId(heading.text);
    return {
      id,
      level: heading.level,
      text: heading.text,
      pos: heading.from,
      collapsed: props.collapsedHeadingIds.includes(id),
      hasChildren,
    };
  });
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

watch(
  () => props.collapsedHeadingIds,
  () => {
    outline.value = parseOutline(props.content);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (parseTimer) {
    clearTimeout(parseTimer);
    parseTimer = null;
  }
});

function handleClick(item: OutlineItem) {
  emit('jump', item.pos, item.id);
}

function toggleCollapse(item: OutlineItem) {
  const next = new Set(props.collapsedHeadingIds);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  emit('update:collapsedHeadingIds', [...next]);
}

const visibleOutline = computed(() => {
  const result: OutlineItem[] = [];
  const hiddenLevels: number[] = [];

  for (const item of outline.value) {
    while (hiddenLevels.length && item.level <= hiddenLevels[hiddenLevels.length - 1]!) {
      hiddenLevels.pop();
    }
    if (hiddenLevels.length) continue;
    result.push(item);
    if (item.collapsed && item.hasChildren) {
      hiddenLevels.push(item.level);
    }
  }

  return result;
});

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

.outline-row {
  display: flex;
  align-items: center;
  margin: 2px 8px;
}

.outline-collapse,
.outline-collapse-placeholder {
  flex: 0 0 18px;
  width: 18px;
  height: 24px;
}

.outline-collapse {
  border: 0;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  padding: 0;
}

.outline-collapse:hover {
  color: var(--vscode-foreground);
}

.outline-item {
  padding: 6px 8px;
  font-size: 13px;
  color: var(--vscode-foreground);
  cursor: pointer;
  border-radius: var(--markly-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  min-width: 0;
  flex: 1;
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
