<template>
  <div
    class="markly-app"
    :class="{
      'files-collapsed': fileTreeCollapsed,
    }"
  >
    <div ref="openSplitRef" class="open-rail">
      <div class="open-split">
        <button class="chrome-btn open-main" type="button" title="打开 Markdown 文件" @click="onOpen">
          <span class="open-label">打开…</span>
        </button>
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
    </div>
    <TabBar
      :tabs="tabs"
      :active-id="activeTabId"
      @activate="onActivateTab"
      @close="onCloseTab"
      @new="onNewTab"
    >
      <template #pre-new>
        <button
          class="chrome-btn tab-copy"
          type="button"
          :disabled="copying"
          :title="copyTitle"
          :aria-label="copyTitle"
          @click="onCopy"
        >⧉</button>
        <div
          ref="exportSplitRef"
          class="export-split"
          @mouseenter="onExportEnter"
          @mouseleave="onExportLeave"
        >
          <button
            class="chrome-btn tab-export"
            type="button"
            :disabled="exporting || isSettingsTab"
            :title="exportOpen ? '' : exportTitle"
            :aria-label="exportTitle"
            aria-haspopup="menu"
            :aria-expanded="exportOpen"
            aria-controls="export-format-menu"
            @click="onExportButtonClick"
          >
            <span>导出</span>
            <span class="export-caret" aria-hidden="true">▾</span>
          </button>
          <div v-if="exportOpen" id="export-format-menu" class="export-menu" role="menu" aria-label="导出格式">
            <button type="button" class="export-item" role="menuitem" data-format="pdf" @click="onPickExport('pdf')">
              导出 PDF
            </button>
            <button type="button" class="export-item" role="menuitem" data-format="html" @click="onPickExport('html')">
              导出 HTML
            </button>
          </div>
        </div>
      </template>
    </TabBar>
    <FileTree
      :collapsed="fileTreeCollapsed"
      :active-path="activeFilePath"
      @toggle="toggleFileTree"
    />
    <main class="preview-area">
      <SettingsPage v-if="isSettingsTab" :appearance="appearance" @update="onUpdateAppearance" />
      <template v-else>
        <aside v-if="hasOutline" class="doc-outline" :class="{ collapsed: outlineCollapsed }">
          <div class="doc-outline-head">
            <span v-if="!outlineCollapsed" class="doc-outline-title">目录</span>
            <button
              class="doc-outline-toggle"
              type="button"
              :title="outlineCollapsed ? '展开目录' : '收起目录'"
              :aria-label="outlineCollapsed ? '展开目录' : '收起目录'"
              :aria-expanded="!outlineCollapsed"
              @click="toggleOutline"
            >{{ outlineCollapsed ? '›' : '‹' }}</button>
          </div>
          <ul v-if="!outlineCollapsed" class="doc-outline-list">
            <li
              v-for="item in outline"
              :key="item.id"
              class="doc-outline-row"
              :class="'level-' + item.level"
              :style="{ paddingLeft: (item.level - 1) * 12 + 12 + 'px' }"
              :title="item.text"
              @click="jumpToHeading(item.id)"
            >{{ item.text }}</li>
          </ul>
        </aside>
        <div class="doc-body">
          <div v-if="loading" class="status">加载中…</div>
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
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useVSCode } from '@wv/composables/useVSCode';
import { headingNodeId, parseHeadings } from '@wv/shared/outline';
import type { HeadingNode } from '@wv/types';
import type { ExtensionMessage } from '@types';
import { buildClipboardWrite, extractPreviewContentHtml } from '../electron/copyPayload';
import { parseExportResult, type AppExportFormat } from '../electron/exportTypes';
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
const exportSplitRef = ref<HTMLElement | null>(null);
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
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copyTitle = computed(() => {
  if (copied.value) return '已复制到剪贴板（Markdown + 富文本）';
  if (copyFailed.value) return '复制失败';
  return '复制全文（Markdown 源 + 预览 HTML）';
});

const exportOpen = ref(false);
const exportPinned = ref(false);
const exporting = ref(false);
const exportHint = ref('');
let exportCloseTimer: ReturnType<typeof setTimeout> | null = null;
let exportHintTimer: ReturnType<typeof setTimeout> | null = null;

const exportTitle = computed(() => {
  if (isSettingsTab.value) return '设置页不能导出';
  if (exporting.value) return '正在导出…';
  if (exportHint.value) return exportHint.value;
  return '导出为 PDF 或 HTML';
});

/**
 * 与导出/预览 heading.id 同契约（权威实现见 src/core/export/headingAnchor.ts）：
 * `{#custom-id}` 优先 → 文本 slug（保留中文）→ 按出现序号兜底。
 */
interface OutlineEntry extends HeadingNode {
  id: string;
}

const outline = computed<OutlineEntry[]>(() =>
  parseHeadings(markdownContent.value).map((h, i) => ({ ...h, id: headingNodeId(h, i + 1) }))
);

/** 没有标题就不显示目录。目录画在正文里面，不单独占一列。 */
const hasOutline = computed(() => outline.value.length > 0);

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

function clearExportCloseTimer(): void {
  if (exportCloseTimer) {
    clearTimeout(exportCloseTimer);
    exportCloseTimer = null;
  }
}

function closeExportMenu(): void {
  exportOpen.value = false;
  exportPinned.value = false;
  clearExportCloseTimer();
}

/** 悬停就展开；离开后稍等再收起，给鼠标挪进菜单的时间。点击钉住的菜单不随鼠标离开关闭。 */
function onExportEnter(): void {
  if (exporting.value || isSettingsTab.value) return;
  clearExportCloseTimer();
  closeRecent();
  exportOpen.value = true;
}

function onExportLeave(): void {
  if (exportPinned.value) return;
  clearExportCloseTimer();
  exportCloseTimer = setTimeout(() => {
    exportOpen.value = false;
    exportCloseTimer = null;
  }, 160);
}

/** 点击同样展开；已经钉住时再点一下收起。 */
function onExportButtonClick(): void {
  if (exporting.value || isSettingsTab.value) return;
  clearExportCloseTimer();
  if (exportPinned.value) {
    closeExportMenu();
    return;
  }
  closeRecent();
  exportPinned.value = true;
  exportOpen.value = true;
}

function flashExport(text: string): void {
  if (exportHintTimer) {
    clearTimeout(exportHintTimer);
    exportHintTimer = null;
  }
  exportHint.value = text;
  exportHintTimer = setTimeout(() => {
    exportHint.value = '';
    exportHintTimer = null;
  }, 1600);
}

async function onPickExport(format: AppExportFormat): Promise<void> {
  closeExportMenu();
  const api = electronApp();
  if (!api?.exportDocument) {
    flashExport('导出失败');
    return;
  }
  if (exporting.value || isSettingsTab.value) return;
  exporting.value = true;
  try {
    const result = parseExportResult(await api.exportDocument(format));
    if (result.ok) flashExport(format === 'pdf' ? '已导出 PDF' : '已导出 HTML');
    else if (!('cancelled' in result)) flashExport(result.error);
  } catch {
    flashExport('导出失败');
  } finally {
    exporting.value = false;
  }
}

async function toggleRecent(): Promise<void> {
  closeExportMenu();
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
  const target = ev.target instanceof Node ? ev.target : null;
  if (recentOpen.value) {
    const root = openSplitRef.value;
    if (!(root && target && root.contains(target))) closeRecent();
  }
  if (exportOpen.value) {
    const root = exportSplitRef.value;
    if (!(root && target && root.contains(target))) closeExportMenu();
  }
}

function onDocKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') {
    closeRecent();
    closeExportMenu();
  }
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

watch(isSettingsTab, (isSettings) => {
  if (isSettings) closeExportMenu();
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
  clearExportCloseTimer();
  if (exportHintTimer) {
    clearTimeout(exportHintTimer);
    exportHintTimer = null;
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
  --chrome-row: 40px;
  display: grid;
  grid-template-columns: var(--files-col) 1fr;
  grid-template-rows: var(--chrome-row) 1fr;
  height: 100vh;
  margin: 0;
}
.markly-app.files-collapsed { --files-col: 40px; }
.markly-app > .tab-bar {
  position: relative;
  z-index: 20;
  grid-column: 2;
  grid-row: 1;
}
/* 打开按钮留在文件树正上方。标签从文件树右缘开始，底边和正文连成一块 */
.open-rail {
  grid-column: 1;
  grid-row: 1;
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 40px;
  padding: 0 8px;
  box-sizing: border-box;
  background: var(--markly-surface, #f6f8fa);
  border-right: 1px solid var(--markly-border-color, #d0d7de);
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
}
.markly-app.files-collapsed .open-label { display: none; }
.markly-app.files-collapsed .open-main::before { content: '开'; }
.markly-app.files-collapsed .open-caret { display: none; }
.markly-app.files-collapsed .open-main {
  border-radius: 6px;
  min-width: 28px;
  padding: 0 6px;
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
  min-width: 0;
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
/* 复制：新建标签页左侧的小图标按钮 */
.tab-copy {
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
/* 导出：紧挨复制，悬停或点击展开 PDF / HTML */
.export-split {
  position: relative;
  align-self: center;
  display: flex;
  margin-right: 4px;
}
.export-split::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 8px;
}
.tab-export {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  font-size: 12px;
}
.export-caret {
  font-size: 10px;
  line-height: 1;
  opacity: 0.75;
}
.export-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 30;
  min-width: 148px;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: 8px;
  background: var(--markly-background, #fff);
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12);
}
.export-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--markly-text, #24292e);
  font-size: 12px;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.export-item:hover { background: var(--markly-surfaceHover, #eaeef2); }

.preview-area {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--markly-background, #fff);
}
/* 目录画在正文内部左侧，和正文同一张白底，不进顶层分栏 */
.doc-outline {
  flex: 0 0 200px;
  width: 200px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  background: var(--markly-background, #fff);
  border-right: 1px solid var(--markly-border-color, #d0d7de);
}
.doc-outline.collapsed {
  flex-basis: 36px;
  width: 36px;
}
.doc-outline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 8px 6px 14px;
  flex-shrink: 0;
}
.doc-outline.collapsed .doc-outline-head {
  justify-content: center;
  padding: 12px 4px;
}
.doc-outline-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--markly-textSecondary, #57606a);
}
.doc-outline-toggle {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--markly-textSecondary, #57606a);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}
.doc-outline-toggle:hover { background: var(--markly-surfaceHover, #eaeef2); }
.doc-outline-list {
  list-style: none;
  margin: 0;
  padding: 4px 0 16px;
  overflow: auto;
  min-height: 0;
  flex: 1;
}
.doc-outline-row {
  font-size: 13px;
  line-height: 1.45;
  padding: 5px 12px 5px 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--markly-text, #24292e);
  user-select: none;
}
.doc-outline-row:hover { background: var(--markly-surfaceHover, #eaeef2); }
.doc-outline-row.level-1 { font-weight: 600; }
.doc-outline-row.level-3,
.doc-outline-row.level-4,
.doc-outline-row.level-5,
.doc-outline-row.level-6 { color: var(--markly-textSecondary, #57606a); }
.doc-body {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--markly-background, #fff);
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