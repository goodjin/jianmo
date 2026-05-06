<template>
  <div
    v-if="outline.length > 0"
    class="outline-panel"
    role="region"
    aria-label="文档大纲"
  >
    <div class="outline-header">
      <span class="outline-title">大纲</span>
      <input
        v-model="outlineSearchQuery"
        type="search"
        class="outline-filter-input"
        placeholder="筛选标题…"
        aria-label="按标题筛选大纲"
        autocomplete="off"
        spellcheck="false"
        @keydown.escape.prevent="outlineSearchQuery = ''"
      />
    </div>
    <div v-if="filterActive && visibleOutline.length === 0" class="outline-filter-empty" role="status">
      无匹配标题
    </div>
    <div v-else class="outline-list">
      <div
        v-for="item in visibleOutline"
        :key="item.stableKey"
        class="outline-row"
        :class="{
          'outline-row-drag-over':
            dragOverTopLevelIndex !== null &&
            item.topLevelIndex >= 0 &&
            dragOverTopLevelIndex === item.topLevelIndex,
        }"
        :style="{ paddingLeft: (item.level - 1) * 12 + 4 + 'px' }"
        @dragover="onRowDragOver(item, $event)"
        @drop="onRowDrop(item, $event)"
      >
        <div v-if="!filterActive && topLevelSectionCount >= 2" class="outline-drag-lead">
          <span
            v-if="item.topLevelIndex >= 0"
            class="outline-drag-handle"
            draggable="true"
            role="button"
            tabindex="-1"
            title="拖动章节顺序（整块移动）"
            aria-label="拖动章节顺序"
            @dragstart.stop="onDragStartItem(item, $event)"
            @dragend="onDragEnd"
            @mousedown.stop
            >⋮⋮</span>
        </div>
        <button
          v-if="!filterActive && item.kind !== 'diagram' && item.hasChildren"
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
        <span
          v-if="item.kind === 'heading' && item.duplicateSlug"
          class="outline-slug-conflict"
          role="img"
          :aria-label="'锚点与其它小节重复：' + item.text"
          title="与其它小节生成相同锚点 ID，Rich 或 # 链接可能总是跳到第一个同名标题"
        >⚠</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import type { EditorMode } from '../../src/types';
import { collectOutlineFilterIndices, generateHeadingId, getDuplicateHeadingSlugs, parseHeadings } from '../shared/outline';
import { parseMermaidOutlineEntries } from '../shared/mermaidOutline';

interface OutlineItem {
  kind: 'heading' | 'diagram';
  /** Vue 列表 key（避免标题下标与图表项冲突） */
  stableKey: string;
  id: string;
  level: number;
  text: string;
  pos: number;
  collapsed: boolean;
  hasChildren: boolean;
  /** M63：与别节 `generateHeadingId` 相同则 true（锚点冲突） */
  duplicateSlug: boolean;
  /** 在 parseHeadings 扁平列表中的下标 */
  headingIndex: number;
  /**
   * 最低大纲级别章节序号（用于 M62 拖拽重排）；-1 表示该行属于更深层小节，不单独成块。
   */
  topLevelIndex: number;
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
  (e: 'reorder', payload: { fromTopLevelIndex: number; toTopLevelIndex: number }): void;
}>();

const outline = ref<OutlineItem[]>([]);
/** M61：标题筛选（本地状态；面板 v-if 关闭时会随组件销毁清空） */
const outlineSearchQuery = ref('');
/** M231：筛选输入防抖，减轻大文档下连续键入时的重算 */
const outlineFilterDebounced = ref('');
const OUTLINE_FILTER_DEBOUNCE_MS = 100;
let outlineFilterTimer: ReturnType<typeof setTimeout> | null = null;
watch(outlineSearchQuery, (q) => {
  if (outlineFilterTimer) {
    clearTimeout(outlineFilterTimer);
    outlineFilterTimer = null;
  }
  outlineFilterTimer = setTimeout(() => {
    outlineFilterDebounced.value = q;
    outlineFilterTimer = null;
  }, OUTLINE_FILTER_DEBOUNCE_MS);
}, { immediate: true });
const filterActive = computed(() => outlineFilterDebounced.value.trim().length > 0);
const MARKLY_TOP_DND = 'markly-outline-top:';
const draggingTopFrom = ref<number | null>(null);
const dragOverTopLevelIndex = ref<number | null>(null);

const topLevelSectionCount = computed(() => {
  let m = 0;
  for (const it of outline.value) {
    if (it.topLevelIndex >= 0) m = Math.max(m, it.topLevelIndex + 1);
  }
  return m;
});

const OUTLINE_PARSE_DEBOUNCE_MS = 250;
let parseTimer: ReturnType<typeof setTimeout> | null = null;
let hasParsedOnce = false;

// 解析内容生成大纲
function parseOutline(content: string): OutlineItem[] {
  const headings = parseHeadings(content);
  const diagrams = parseMermaidOutlineEntries(content);
  if (headings.length === 0 && diagrams.length === 0) return [];

  const duplicateIds = headings.length ? getDuplicateHeadingSlugs(headings) : new Set<string>();
  const minLevel = headings.length ? Math.min(...headings.map((h) => h.level)) : 1;
  let topLevelCounter = 0;

  const headingItems: OutlineItem[] = headings.map((heading, index) => {
    let hasChildren = false;
    for (const next of headings.slice(index + 1)) {
      if (next.level <= heading.level) break;
      hasChildren = true;
      break;
    }
    const id = generateHeadingId(heading.text);
    const isTop = heading.level === minLevel;
    const topLevelIndex = isTop ? topLevelCounter++ : -1;
    return {
      kind: 'heading',
      stableKey: `h:${index}:${id}`,
      id,
      level: heading.level,
      text: heading.text,
      pos: heading.from,
      collapsed: props.collapsedHeadingIds.includes(id),
      hasChildren,
      duplicateSlug: duplicateIds.has(id),
      headingIndex: index,
      topLevelIndex,
    };
  });

  const diagramItems: OutlineItem[] = diagrams.map((d) => ({
    kind: 'diagram',
    stableKey: `d:${d.index}:${d.id}`,
    id: d.id,
    level: 2,
    text: d.label,
    pos: d.from,
    collapsed: false,
    hasChildren: false,
    duplicateSlug: false,
    headingIndex: -1,
    topLevelIndex: -1,
  }));

  const merged = [
    ...headingItems.map((item) => ({ sort: item.pos, item })),
    ...diagramItems.map((item) => ({ sort: item.pos, item })),
  ];
  merged.sort((a, b) => a.sort - b.sort);
  return merged.map((row) => row.item);
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
  if (outlineFilterTimer) {
    clearTimeout(outlineFilterTimer);
    outlineFilterTimer = null;
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

function onDragStartItem(item: OutlineItem, e: DragEvent) {
  if (item.topLevelIndex < 0) return;
  draggingTopFrom.value = item.topLevelIndex;
  try {
    e.dataTransfer?.setData('text/plain', `${MARKLY_TOP_DND}${item.topLevelIndex}`);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  } catch {
    // ignore
  }
}

function onDragEnd() {
  draggingTopFrom.value = null;
  dragOverTopLevelIndex.value = null;
}

function onRowDragOver(item: OutlineItem, e: DragEvent) {
  if (draggingTopFrom.value === null || item.topLevelIndex < 0) return;
  e.preventDefault();
  try {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  } catch {
    // ignore
  }
  dragOverTopLevelIndex.value = item.topLevelIndex;
}

function onRowDrop(item: OutlineItem, e: DragEvent) {
  if (item.topLevelIndex < 0) return;
  let from = draggingTopFrom.value;
  const raw = e.dataTransfer?.getData('text/plain') ?? '';
  if (raw.startsWith(MARKLY_TOP_DND)) {
    const n = parseInt(raw.slice(MARKLY_TOP_DND.length), 10);
    if (!Number.isNaN(n)) from = n;
  }
  if (from === null || Number.isNaN(from)) {
    onDragEnd();
    return;
  }
  if (from === item.topLevelIndex) {
    onDragEnd();
    return;
  }
  emit('reorder', { fromTopLevelIndex: from, toTopLevelIndex: item.topLevelIndex });
  onDragEnd();
}

const visibleOutline = computed(() => {
  const allowed = collectOutlineFilterIndices(outline.value, outlineFilterDebounced.value);
  if (allowed !== null) {
    if (allowed.size === 0) return [];
    return outline.value.filter((_, i) => allowed.has(i));
  }
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.outline-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.outline-filter-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35)));
  border-radius: var(--markly-radius-sm);
}

.outline-filter-input::placeholder {
  color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground));
}

.outline-filter-input:focus {
  outline: 1px solid var(--vscode-focusBorder, #007acc);
  outline-offset: -1px;
}

.outline-filter-empty {
  padding: 12px 12px 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
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

.outline-row-drag-over {
  border-radius: var(--markly-radius-sm);
  box-shadow: inset 0 0 0 1px var(--vscode-focusBorder, #007acc);
}

.outline-drag-lead {
  flex: 0 0 14px;
  width: 14px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.outline-drag-handle {
  cursor: grab;
  font-size: 9px;
  line-height: 1;
  letter-spacing: -1px;
  color: var(--vscode-descriptionForeground);
  user-select: none;
}

.outline-drag-handle:active {
  cursor: grabbing;
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

.outline-slug-conflict {
  flex: 0 0 auto;
  font-size: 12px;
  line-height: 1;
  margin-left: 2px;
  color: var(--vscode-list-warningForeground, var(--vscode-editorWarning-foreground, #cca700));
  user-select: none;
}

.outline-item.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>
