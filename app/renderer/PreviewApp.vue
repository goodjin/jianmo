<template>
  <div
    class="markly-app"
    :class="{
      'files-collapsed': fileTreeCollapsed,
      'outline-collapsed': outlineCollapsed,
      'no-outline': isSettingsTab || !hasOutline,
    }"
  >
    <TabBar
      :tabs="tabs"
      :active-id="activeTabId"
      @activate="onActivateTab"
      @close="onCloseTab"
      @new="onNewTab"
    >
      <template #left>
        <div ref="openSplitRef" class="open-split">
          <button class="chrome-btn open-main" type="button" title="打开 Markdown 文件" @click="onOpen">打开…</button>
          <button
            class="chrome-btn open-caret"
            type="button"
            title="最近打开"
            aria-label="最近打开"
            :aria-expanded="recentOpen"
            @click="toggleRecent"
          >▾</button>
          <RecentFilesMenu v-if="recentOpen" ref="recentMenuRef" @open="onOpenRecent" @settings="onOpenSettings" />
        </div>
      </template>
      <template #pre-new>
        <button
          class="chrome-btn tab-copy"
          :class="{ 'is-copied': copied, 'is-failed': copyFailed }"
          type="button"
          :disabled="copying"
          :title="copyTitle"
          :aria-label="copyTitle"
          @click="onCopy"
        >
          <svg v-if="copied" :key="copiedTick" class="tab-copy-mark" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.4 8.2 6.5 11.3 12.7 4.7" />
          </svg>
          <span v-else aria-hidden="true">⧉</span>
        </button>
      </template>
    </TabBar>
    <FileTree
      :collapsed="fileTreeCollapsed"
      :active-path="activeFilePath"
      @toggle="toggleFileTree"
    />
    <aside v-if="!isSettingsTab && hasOutline" class="outline-sidebar" :class="{ collapsed: outlineCollapsed }">
      <div class="outline-head">
        <span v-if="!outlineCollapsed" class="outline-head-title">目录</span>
        <button
          class="outline-toggle"
          type="button"
          :title="outlineCollapsed ? '展开目录' : '收起目录'"
          :aria-label="outlineCollapsed ? '展开目录' : '收起目录'"
          :aria-expanded="!outlineCollapsed"
          @click="toggleOutline"
        >{{ outlineCollapsed ? '›' : '‹' }}</button>
      </div>
      <ul v-if="!outlineCollapsed" class="outline-list">
        <li
          v-for="item in outline"
          :key="item.id"
          class="outline-row"
          :class="['level-' + item.level]"
          :style="{ paddingLeft: (item.level - 1) * 12 + 12 + 'px' }"
          :title="item.text"
          @click="jumpToHeading(item.id)"
        >{{ item.text }}</li>
      </ul>
    </aside>
    <main class="preview-area">
      <SettingsPage v-if="isSettingsTab" :appearance="appearance" @update="onUpdateAppearance" />
      <div v-else-if="loading" class="status">加载中…</div>
      <div v-else-if="error" class="status error">渲染失败：{{ error }}</div>
      <iframe
        v-else
        ref="frameRef"
        class="preview-frame"
        :srcdoc="safeHtml"
        sandbox="allow-scripts allow-popups"
        referrerpolicy="no-referrer"
        @load="onFrameLoad"
      ></iframe>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useVSCode } from '@wv/composables/useVSCode';
import { headingNodeId, parseHeadings } from '@wv/shared/outline';
import type { HeadingNode } from '@wv/types';
import type { ExtensionMessage } from '@types';
import { buildClipboardWrite, extractPreviewContentHtml } from '../electron/copyPayload';
import { collectDroppedMarkdownPaths, type DroppedFileLike } from './dropFiles';
import {
  electronApp,
  parseAppearance,
  parseTabsView,
  type AppearanceState,
  type TabSummary,
} from './electronBridge';
import { applyEditorPalette, resolveEditorPalette } from '@wv/shared/themeConfig';
import FileTree from './FileTree.vue';
import RecentFilesMenu from './RecentFilesMenu.vue';
import SettingsPage from './SettingsPage.vue';
import TabBar from './TabBar.vue';

const { postMessage, onMessage } = useVSCode();

const loading = ref(true);
const previewHtml = ref('');
const markdownContent = ref('');
const error = ref('');
const tabs = ref<TabSummary[]>([]);
const activeTabId = ref('');
const appearance = ref<AppearanceState>(parseAppearance(null));

const isSettingsTab = computed(
  () => tabs.value.find((t) => t.id === activeTabId.value)?.kind === 'settings'
);
const frameRef = ref<HTMLIFrameElement | null>(null);
const openSplitRef = ref<HTMLElement | null>(null);
const recentMenuRef = ref<{ refresh: () => Promise<void> } | null>(null);
const recentOpen = ref(false);
const outlineCollapsed = ref(false);
const fileTreeCollapsed = ref(false);
const activeFilePath = computed(
  () => tabs.value.find((t) => t.id === activeTabId.value)?.filePath ?? ''
);
const copying = ref(false);
const copied = ref(false);
const copyFailed = ref(false);
/** 每次成功都 +1，让打勾 SVG 重新挂载，连点时描边动画会再播一次。 */
const copiedTick = ref(0);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copyTitle = computed(() => {
  if (copied.value) return '已复制到剪贴板（Markdown + 富文本）';
  if (copyFailed.value) return '复制失败';
  return '复制全文（Markdown 源 + 预览 HTML）';
});

/**
 * 与导出/预览 heading.id 同契约（权威实现见 src/core/export/headingAnchor.ts）：
 * `{#custom-id}` 优先 → 文本 slug（保留中文）→ 按出现序号兜底，保证 outline headingId 与 iframe 内 heading.id 完全匹配。
 * 统一走 `@wv/shared/outline` 的 headingNodeId，避免三处锚点规则各自漂移。
 */
interface OutlineEntry extends HeadingNode {
  id: string;
}

const outline = computed<OutlineEntry[]>(() =>
  parseHeadings(markdownContent.value).map((h, i) => ({ ...h, id: headingNodeId(h, i + 1) }))
);

/** 文档没有标题时整栏不出现（连同展开/收起按钮），预览区占满宽度。 */
const hasOutline = computed(() => outline.value.length > 0);

/**
 * 父→子：通过 postMessage 让 iframe 滚动到目标 heading。
 * iframe 内联监听见 src/core/export/htmlExport.ts 的 inline <script>。
 * 跨 sandbox（无 allow-same-origin）下唯一可靠的通信方式。
 */
function jumpToHeading(headingId: string): void {
  frameRef.value?.contentWindow?.postMessage({ type: 'SCROLL_TO_HEADING', headingId }, '*');
}

/**
 * 给外部链接加 target=_blank rel=noopener，使主进程 setWindowOpenHandler 能拦截到新窗口请求并 shell.openExternal。
 * 不可依赖访问 iframe contentDocument（sandbox 让 srcdoc origin opaque）。
 */
function withExternalLinkTargets(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}

const safeHtml = computed(() => withExternalLinkTargets(previewHtml.value));

/**
 * 每个标签缓存一份已渲染的预览，key 是标签 id，value 连正文一起存。
 * 正文变了就判缓存失效，所以切回旧标签是瞬时的，而改动过的文档不会拿到陈旧 HTML。
 */
const previewCache = new Map<string, { content: string; html: string }>();

function applyTabsView(raw: unknown): void {
  const view = parseTabsView(raw);
  tabs.value = view.tabs;
  activeTabId.value = view.activeId;
  // 关掉的标签不再占着缓存
  const alive = new Set(view.tabs.map((t) => t.id));
  for (const id of [...previewCache.keys()]) {
    if (!alive.has(id)) previewCache.delete(id);
  }
}

/** 把所选配色写成根节点上的 CSS 变量，外壳（顶栏/标签条/侧栏/设置页）据此变色。 */
function applyShellPalette(): void {
  const palette = resolveEditorPalette(appearance.value.theme, appearance.value.prefersDark);
  applyEditorPalette(document.documentElement, palette);
}

function refreshAppearance(): void {
  try {
    appearance.value = parseAppearance(electronApp()?.getAppearance?.());
  } catch {
    /* 桥未就绪：留用默认外观 */
  }
  applyShellPalette();
}

async function onUpdateAppearance(patch: Partial<AppearanceState>): Promise<void> {
  const next = await electronApp()?.updateAppearance?.(patch);
  if (next) appearance.value = parseAppearance(next);
  applyShellPalette();
  // 配色与字体都进了预览 HTML，旧缓存全部作废
  previewCache.clear();
}

function onOpenSettings(): void {
  closeRecent();
  void electronApp()?.openSettingsTab?.();
}

function refreshTabs(): void {
  try {
    applyTabsView(electronApp()?.tabsState?.());
  } catch {
    /* 桥未就绪：标签条留空，预览仍可用 */
  }
}

function onActivateTab(id: string): void {
  closeRecent();
  if (id === activeTabId.value) return;
  void electronApp()?.activateTab?.(id);
}

function onCloseTab(id: string): void {
  closeRecent();
  void electronApp()?.closeTab?.(id);
}

function onNewTab(): void {
  closeRecent();
  void electronApp()?.newTab?.();
}

function persistOutlineCollapsed(): void {
  try {
    electronApp()?.storeSet?.('outlineCollapsed', outlineCollapsed.value);
  } catch {
    /* ignore */
  }
}

function toggleOutline(): void {
  outlineCollapsed.value = !outlineCollapsed.value;
  persistOutlineCollapsed();
}

function toggleFileTree(): void {
  fileTreeCollapsed.value = !fileTreeCollapsed.value;
  try {
    electronApp()?.storeSet?.('fileTreeCollapsed', fileTreeCollapsed.value);
  } catch {
    /* ignore */
  }
}

function closeRecent(): void {
  recentOpen.value = false;
}

async function toggleRecent(): Promise<void> {
  recentOpen.value = !recentOpen.value;
  if (recentOpen.value) {
    await nextTick();
    void recentMenuRef.value?.refresh?.();
  }
}

function onOpen(): void {
  closeRecent();
  void electronApp()?.openFile?.();
}

async function onOpenRecent(p: string): Promise<void> {
  closeRecent();
  // 主进程打开成功后会推 app:tabs + CONTENT_UPDATE，标签条与预览由那条链路更新
  await electronApp()?.openPath?.(p);
}

function onDocMouseDown(ev: MouseEvent): void {
  if (!recentOpen.value) return;
  const root = openSplitRef.value;
  if (root && ev.target instanceof Node && root.contains(ev.target)) return;
  closeRecent();
}

function onDocKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') closeRecent();
}

/** 允许把文件放到窗口任意位置（不 preventDefault 的话 drop 不触发）。 */
function onDragOver(ev: DragEvent): void {
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
  ev.preventDefault();
}

/** 拖 Markdown 文档进界面 → 自动打开；多份按拖入顺序逐个开标签。 */
async function onDrop(ev: DragEvent): Promise<void> {
  ev.preventDefault();
  const files = ev.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const paths = collectDroppedMarkdownPaths(files as unknown as ArrayLike<DroppedFileLike>);
  for (const p of paths) {
    await electronApp()?.openPath?.(p);
  }
}

function flashCopyState(ok: boolean): void {
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
  copied.value = ok;
  copyFailed.value = !ok;
  if (ok) copiedTick.value += 1;
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copyFailed.value = false;
    copiedTimer = null;
  }, 1600);
}

async function onCopy(): Promise<void> {
  const api = electronApp();
  if (!api?.copyToClipboard) {
    flashCopyState(false);
    return;
  }
  if (copying.value) return;
  copying.value = true;
  try {
    const payload = buildClipboardWrite({
      markdown: markdownContent.value,
      contentHtml: extractPreviewContentHtml(previewHtml.value),
    });
    const ok = await api.copyToClipboard(payload);
    flashCopyState(ok !== false);
  } catch {
    flashCopyState(false);
  } finally {
    copying.value = false;
  }
}

/**
 * 拦截 iframe 内 <a> 点击：外部 http(s) 链接走宿主 shell.openExternal（沙箱阻止顶级导航）。
 * 锚点 # 由 iframe 内 inline <script> 自行处理（mousedown/pointerdown/click + scrollIntoView），这里不抢。
 * 当前 sandbox 无 allow-same-origin，contentDocument 访问会抛 SecurityError，try/catch 兜住。
 */
function onFrameLoad(): void {
  const frame = frameRef.value;
  if (!frame) return;
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener(
      'click',
      (ev) => {
        const a = (ev.target as HTMLElement | null)?.closest('a');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) {
          ev.preventDefault();
          ev.stopPropagation();
          postMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: href } });
        }
      },
      true
    );
  } catch {
    /* cross-origin, ignore */
  }
}

function requestPreview(): void {
  if (isSettingsTab.value) {
    loading.value = false;
    error.value = '';
    return;
  }
  const cached = previewCache.get(activeTabId.value);
  if (cached && cached.content === markdownContent.value) {
    previewHtml.value = cached.html;
    error.value = '';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  postMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} });
}

const off = onMessage((msg: ExtensionMessage) => {
  switch (msg.type) {
    case 'INIT':
      // INIT.payload.content 是当前 markdown 源；存下来供大纲解析
      markdownContent.value = msg.payload.content ?? '';
      refreshTabs();
      requestPreview();
      break;
    case 'CONTENT_UPDATE':
      markdownContent.value = msg.payload.content ?? '';
      requestPreview();
      break;
    case 'PREVIEW_HTML':
      if (msg.payload.error) {
        error.value = msg.payload.error;
      } else {
        previewHtml.value = msg.payload.html ?? '';
        if (activeTabId.value) {
          previewCache.set(activeTabId.value, {
            content: markdownContent.value,
            html: previewHtml.value,
          });
        }
      }
      loading.value = false;
      break;
    case 'CONFIG_CHANGE':
      // 主题/字体变了，或系统明暗在 auto 下切换：外壳换色，预览缓存作废后重出
      refreshAppearance();
      previewCache.clear();
      requestPreview();
      break;
    case 'SWITCH_MODE':
      if (msg.payload.mode === 'preview') requestPreview();
      break;
  }
});

const offCopyRequest = electronApp()?.onCopyRequest?.(() => {
  void onCopy();
});

const offTabsChanged = electronApp()?.onTabsChanged?.((view) => {
  applyTabsView(view);
});

onMounted(() => {
  refreshTabs();
  refreshAppearance();
  try {
    outlineCollapsed.value = electronApp()?.storeGet?.('outlineCollapsed') === true;
  } catch {
    outlineCollapsed.value = false;
  }
  try {
    fileTreeCollapsed.value = electronApp()?.storeGet?.('fileTreeCollapsed') === true;
  } catch {
    fileTreeCollapsed.value = false;
  }
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onDocKeydown);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);
  postMessage({ type: 'READY', payload: undefined });
});

onUnmounted(() => {
  off();
  offCopyRequest?.();
  offTabsChanged?.();
  document.removeEventListener('mousedown', onDocMouseDown);
  document.removeEventListener('keydown', onDocKeydown);
  document.removeEventListener('dragover', onDragOver);
  document.removeEventListener('drop', onDrop);
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
});
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
}
.markly-app {
  --files-col: 220px;
  --outline-col: 240px;
  display: grid;
  grid-template-columns: var(--files-col) var(--outline-col) 1fr;
  grid-template-rows: auto 1fr;
  height: 100vh;
  margin: 0;
}
.markly-app.files-collapsed { --files-col: 40px; }
.markly-app.outline-collapsed { --outline-col: 40px; }
.markly-app.no-outline {
  grid-template-columns: var(--files-col) 1fr;
}
.markly-app.no-outline .preview-area {
  grid-column: 2;
}
.markly-app > .tab-bar {
  grid-column: 1 / -1;
  grid-row: 1;
}
.chrome-btn {
  font-size: 12px;
  line-height: 1.3;
  padding: 6px 12px;
  min-height: 32px;
  box-sizing: border-box;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  cursor: pointer;
}
.chrome-btn:hover { background: var(--markly-surface, #f6f8fa); }
.chrome-btn:disabled { opacity: 0.55; cursor: default; }
.chrome-btn.active {
  border-color: var(--markly-primary, #0969da);
  color: var(--markly-primary, #0969da);
}
.open-split {
  position: relative;
  display: flex;
  align-items: stretch;
  align-self: center;
  margin: 0 6px 0 8px;
}
.open-split .open-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: 0;
}
.open-split .open-caret {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 6px 10px;
  min-width: 32px;
}
/* 复制：新建标签页左侧的小图标按钮。成功后换成绿色打勾，约 1.6 秒后恢复。 */
.tab-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 28px;
  min-width: 28px;
  height: 26px;
  min-height: 26px;
  padding: 0;
  margin-right: 4px;
  font-size: 14px;
  line-height: 1;
}
.tab-copy:disabled { opacity: 0.55; }
.tab-copy.is-copied {
  color: #1a7f37;
  border-color: #1a7f37;
  background: #dafbe1;
}
.tab-copy.is-copied:hover {
  background: #aceebb;
}
.tab-copy.is-failed {
  color: var(--markly-error, #cf222e);
  border-color: var(--markly-error, #cf222e);
}
:global(html[data-theme='dark']) .tab-copy.is-copied {
  color: #3fb950;
  border-color: #3fb950;
  background: rgba(63, 185, 80, 0.18);
}
:global(html[data-theme='dark']) .tab-copy.is-copied:hover {
  background: rgba(63, 185, 80, 0.28);
}
.tab-copy-mark {
  width: 15px;
  height: 15px;
  display: block;
  overflow: visible;
}
.tab-copy-mark path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  animation: tab-copy-draw 280ms ease-out forwards;
}
@keyframes tab-copy-draw {
  to { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tab-copy-mark path {
    animation: none;
    stroke-dashoffset: 0;
  }
}

.outline-sidebar {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--markly-border-color, #d0d7de);
  background: var(--markly-surface, #fafbfc);
  min-height: 0;
}
.outline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 10px 14px;
  min-height: 40px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
  flex-shrink: 0;
}
.outline-head-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--markly-text, #1f2328);
  padding: 4px 0;
  line-height: 1.4;
}
.outline-toggle {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 6px;
  background: var(--markly-background, #fff);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--markly-text, #24292e);
  flex-shrink: 0;
}
.outline-toggle:hover { background: var(--markly-surface, #f6f8fa); }
.outline-sidebar.collapsed .outline-head {
  flex-direction: column;
  justify-content: flex-start;
  padding: 8px 6px;
  border-bottom: 0;
  min-height: 0;
  height: 100%;
}
.outline-list {
  list-style: none;
  padding: 8px 0 12px;
  margin: 0;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}
.outline-row {
  font-size: 12px;
  line-height: 1.5;
  padding: 6px 14px 6px 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--markly-text, #24292e);
  user-select: none;
}
.outline-row:hover { background: var(--markly-surfaceHover, #eaeef2); }
.outline-row.level-1 { font-weight: 600; color: var(--markly-text, #1f2328); }
.outline-row.level-2 { font-weight: 500; color: var(--markly-text, #2f363d); }
.outline-row.level-3,
.outline-row.level-4,
.outline-row.level-5,
.outline-row.level-6 { color: var(--markly-textSecondary, #57606a); }
.outline-empty {
  padding: 20px 14px;
  color: var(--markly-textSecondary, #6a737d);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.preview-area {
  grid-column: 3;
  grid-row: 2;
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--markly-background, #fff);
}
.status { padding: 24px; color: var(--markly-textSecondary, #666); }
.status.error { color: var(--markly-error, #d33); }
</style>