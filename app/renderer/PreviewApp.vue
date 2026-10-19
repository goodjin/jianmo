<template>
  <div
    class="markly-app"
    :style="chromeRadiusStyle"
    :class="{
      'files-collapsed': fileTreeCollapsed,
    }"
  >
    <div ref="openSplitRef" class="open-rail">
      <div class="open-split">
        <!--
          预览在沙箱 iframe 里，父页面收不到里面的空白点击。
          菜单打开时铺一层全屏透明层，点到菜单和打开按钮以外就收起。
        -->
        <div
          v-if="recentOpen"
          class="recent-dismiss"
          aria-hidden="true"
          @pointerdown.stop.prevent="closeRecent"
          @click.stop="closeRecent"
        />
        <button class="chrome-btn open-main" type="button" title="打开 Markdown 或 JSON 文件" @click="onOpen">
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
        <RecentFilesMenu v-if="recentOpen" ref="recentMenuRef" @open="onOpenRecent" />
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
          class="chrome-btn tab-reload"
          type="button"
          :disabled="reloadDisabled"
          :title="reloadTitle"
          :aria-label="reloadTitle"
          @click="onReload"
        >刷新</button>
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
          <!-- 两个错开的圆角矩形，前一张盖住后一张。线宽和打勾同一套。 -->
          <svg v-else class="tab-copy-icon" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="5.333" y="5.333" width="9.333" height="9.333" rx="1.333" ry="1.333" />
            <path d="M2.667 10.667c-.733 0-1.333-.6-1.333-1.333V2.667c0-.733.6-1.333 1.333-1.333h6.667c.733 0 1.333.6 1.333 1.333" />
          </svg>
        </button>
        <button
          class="chrome-btn tab-source"
          type="button"
          :disabled="isSettingsTab"
          :class="{ active: sourceOpen }"
          :title="sourceTitle"
          :aria-label="sourceTitle"
          :aria-pressed="sourceOpen"
          @click="toggleSource"
        >{{ sourceLabel }}</button>
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
              PDF
            </button>
            <button type="button" class="export-item" role="menuitem" data-format="html" @click="onPickExport('html')">
              HTML
            </button>
          </div>
        </div>
        <button
          class="chrome-btn tab-settings"
          type="button"
          title="设置（Cmd/Ctrl+,）"
          aria-label="设置"
          :class="{ active: isSettingsTab }"
          @click="onOpenSettings"
        >设置</button>
      </template>
    </TabBar>
    <FileTree
      :collapsed="fileTreeCollapsed"
      :active-path="activeFilePath"
      @toggle="toggleFileTree"
    />
    <main class="preview-area">
      <p
        v-if="visibleReloadTip"
        :key="visibleReloadTip.seq"
        class="reload-tip"
        :class="'is-' + visibleReloadTip.kind"
        role="status"
      >{{ visibleReloadTip.text }}</p>
      <div class="preview-stage">
      <SettingsPage
        v-if="isSettingsTab"
        :appearance="appearance"
        :system-fonts="systemFonts"
        :copy-on-select="copyOnSelect"
        @update="onUpdateAppearance"
        @update-reader="onUpdateReader"
      />
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
          <div v-if="isBlankDoc && !sourceOpen" class="blank-page">
            <button class="chrome-btn blank-open" type="button" @click="onOpen">打开</button>
            <p class="blank-hint">从左侧文件里点开一篇，或在这里选择文件。</p>
          </div>
          <div v-else-if="sourceOpen" class="source-pane">
            <p v-if="sourceNote" class="source-note">{{ sourceNote }}</p>
            <pre
              ref="sourceViewRef"
              class="source-view"
              :style="{ fontSize: appearance.fontSize + 'px' }"
            >{{ sourceText }}</pre>
          </div>
          <template v-else>
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
          </template>
        </div>
      </template>
      </div>
      <p v-if="selectionToast" class="selection-toast" role="status">{{ selectionToast }}</p>
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
import { structuredKindFromName } from '../electron/documentKind';
import { formatDocumentSource, sourceFormatNote } from '../electron/sourceText';
import {
  parseReloadResult,
  RELOAD_MISSING_TIP,
  RELOAD_OK_TIP,
  RELOAD_TIP_OK_MS,
  RELOAD_UNREADABLE_TIP,
} from '../electron/reloadResult';
import { readBoxCopyPayload } from '../electron/jsonView';
import {
  PLACE_READ,
  PLACE_RESTORE,
  captureSourceAnchor,
  keepPlace,
  measureSourceBox,
  readPlaceAnchor,
  scrollTopForSource,
  type PlaceAnchor,
} from '../electron/viewPlace';
import { readReaderPrefs } from '../electron/readerPrefs';
import { acceptSelectionCopyMessage } from '../electron/selectionCopy';
import { collectDroppedDocumentPaths, type DroppedFileLike } from './dropFiles';
import { parseSystemFontList } from '../electron/appearance';
import {
  electronApp,
  parseAppearance,
  parseTabsView,
  type AppearanceState,
  type TabSummary,
} from './electronBridge';
import { applyEditorPalette, resolveEditorPalette } from '@wv/shared/themeConfig';
import { buildPreviewSrcdoc, visibleTextFromHtml } from './previewSrcdoc';
import { chromeRadiusStyle } from '../chromeRadius';
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
const systemFonts = ref<string[]>([]);
const systemFontsKnown = ref(false);

const isSettingsTab = computed(
  () => tabs.value.find((t) => t.id === activeTabId.value)?.kind === 'settings'
);
const frameRef = ref<HTMLIFrameElement | null>(null);
const sourceViewRef = ref<HTMLElement | null>(null);
const openSplitRef = ref<HTMLElement | null>(null);
const exportSplitRef = ref<HTMLElement | null>(null);
const recentMenuRef = ref<{ refresh: () => Promise<void> } | null>(null);
const recentOpen = ref(false);
const outlineCollapsed = ref(false);
const fileTreeCollapsed = ref(false);
const activeFilePath = computed(
  () => tabs.value.find((t) => t.id === activeTabId.value)?.filePath ?? ''
);
/** 还没装上文件的文档标签。设置页不算。 */
const isBlankDoc = computed(() => !isSettingsTab.value && !activeFilePath.value);
const copying = ref(false);
const copied = ref(false);
const copyFailed = ref(false);
/** 每次成功都 +1，让打勾重新画一遍，连点时动画会再播一次。 */
const copiedTick = ref(0);
const copyOnSelect = ref(true);
const selectionToast = ref('');
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
let selectionToastTimer: ReturnType<typeof setTimeout> | null = null;
let blurCloseTimer: ReturnType<typeof setTimeout> | null = null;

const copiedHint = ref('已复制到剪贴板');
const copyTitle = computed(() => {
  if (copied.value) return copiedHint.value;
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
 * 每个文档标签各自记住：在看源码还是预览，以及视口上方附近的那一句。
 * 关掉标签就忘掉。高度两边不一样，所以记的是文字，不是一个像素。
 */
interface TabReading {
  source: boolean;
  anchor: PlaceAnchor | null;
}

const readingByTab = new Map<string, TabReading>();
const sourceOpen = ref(false);
/** 切标签或切回预览之后，等正文到了再滚回记下的那一句。 */
let wantRestore = false;
let placeBusy = false;

const sourceLabel = computed(() => (sourceOpen.value ? '渲染' : '源码'));

const sourceTitle = computed(() => {
  if (isSettingsTab.value) return '设置页没有源码';
  return sourceOpen.value ? '渲染' : '查看源码';
});

const sourceText = computed(() => formatDocumentSource(markdownContent.value, activeFilePath.value));
const sourceNote = computed(() => sourceFormatNote(markdownContent.value, activeFilePath.value));

function readingOf(id: string): TabReading {
  return readingByTab.get(id) ?? { source: false, anchor: null };
}

function putReading(id: string, patch: Partial<TabReading>): void {
  if (!id) return;
  readingByTab.set(id, { ...readingOf(id), ...patch });
}

function syncSourceOpen(): void {
  if (isSettingsTab.value || !activeTabId.value) {
    sourceOpen.value = false;
    return;
  }
  sourceOpen.value = readingOf(activeTabId.value).source;
}

function captureSourceNow(): PlaceAnchor | null {
  const pre = sourceViewRef.value;
  if (!pre) return null;
  return captureSourceAnchor(sourceText.value, pre.scrollTop, measureSourceBox(pre));
}

/** 问预览现在看到哪。沙箱读不到正文，等它回一句；没回就当还在文首。 */
function capturePreviewAnchor(): Promise<PlaceAnchor> {
  const frame = frameRef.value;
  const win = frame?.contentWindow ?? null;
  if (!frame || !win) return Promise.resolve({ snippet: '', ratio: 0 });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (anchor: PlaceAnchor) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(anchor);
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== win) return;
      const anchor = readPlaceAnchor(ev.data);
      if (!anchor) return;
      finish(anchor);
    };
    window.addEventListener('message', onMsg);
    const timer = setTimeout(() => finish({ snippet: '', ratio: 0 }), 100);
    try {
      win.postMessage({ type: PLACE_READ }, '*');
    } catch {
      finish({ snippet: '', ratio: 0 });
    }
  });
}

async function captureCurrentAnchor(): Promise<PlaceAnchor> {
  if (sourceOpen.value) return captureSourceNow() ?? { snippet: '', ratio: 0 };
  return capturePreviewAnchor();
}

function applySourceScroll(anchor: PlaceAnchor | null): void {
  const pre = sourceViewRef.value;
  if (!pre || !anchor) return;
  const top = scrollTopForSource(sourceText.value, anchor, measureSourceBox(pre));
  pre.scrollTop = top;
  console.info('[markly] 源码停在原处', { top, snippet: anchor.snippet });
}

function postPreviewRestore(anchor: PlaceAnchor | null): boolean {
  const win = frameRef.value?.contentWindow;
  if (!win || !anchor) return false;
  try {
    win.postMessage({ type: PLACE_RESTORE, snippet: anchor.snippet, ratio: anchor.ratio }, '*');
    return true;
  } catch {
    return false;
  }
}

function restoreArmedSource(): void {
  if (!wantRestore || !sourceOpen.value) return;
  const id = activeTabId.value;
  const anchor = readingOf(id).anchor;
  wantRestore = false;
  void nextTick(() => {
    if (activeTabId.value !== id || !sourceOpen.value) return;
    applySourceScroll(anchor);
  });
}

async function rememberActivePlace(): Promise<void> {
  const id = activeTabId.value;
  if (!id || isSettingsTab.value) return;
  const anchor = keepPlace(await captureCurrentAnchor(), readingOf(id).anchor);
  putReading(id, { source: sourceOpen.value, anchor });
}

async function toggleSource(): Promise<void> {
  if (placeBusy || isSettingsTab.value || !activeTabId.value) return;
  const id = activeTabId.value;
  placeBusy = true;
  try {
    const anchor = keepPlace(await captureCurrentAnchor(), readingOf(id).anchor);
    const next = !sourceOpen.value;
    putReading(id, { source: next, anchor });
    sourceOpen.value = next;
    console.info('[markly] 切换源码', { open: next, file: activeFilePath.value, snippet: anchor.snippet });
    await nextTick();
    if (activeTabId.value !== id) return;
    if (next) applySourceScroll(anchor);
    else {
      wantRestore = true;
      if (!postPreviewRestore(anchor)) {
        /* 预览框还没画出来，等它加载完再滚。 */
      }
    }
  } finally {
    placeBusy = false;
  }
}

const reloading = ref(false);
const reloadDisabled = computed(
  () => isSettingsTab.value || !activeFilePath.value || reloading.value
);
const reloadTitle = computed(() => {
  if (isSettingsTab.value) return '设置页不能刷新';
  if (!activeFilePath.value) return '还没有文件可刷新';
  if (reloading.value) return '正在重新加载…';
  return '重新加载文档';
});

interface ReloadTip {
  tabId: string;
  seq: number;
  kind: 'ok' | 'missing' | 'unreadable';
  text: string;
}

const reloadTip = ref<ReloadTip | null>(null);
let reloadTipTimer: ReturnType<typeof setTimeout> | null = null;
let reloadTipSeq = 0;

const visibleReloadTip = computed(() => {
  const tip = reloadTip.value;
  if (!tip || isSettingsTab.value || tip.tabId !== activeTabId.value) return null;
  return tip;
});

function clearReloadTipTimer(): void {
  if (reloadTipTimer) {
    clearTimeout(reloadTipTimer);
    reloadTipTimer = null;
  }
}

function showReloadTip(kind: ReloadTip['kind'], text: string, autoHide: boolean): void {
  clearReloadTipTimer();
  const seq = ++reloadTipSeq;
  reloadTip.value = { tabId: activeTabId.value, seq, kind, text };
  if (!autoHide) return;
  reloadTipTimer = setTimeout(() => {
    reloadTipTimer = null;
    if (reloadTip.value?.seq === seq) reloadTip.value = null;
  }, RELOAD_TIP_OK_MS);
}

async function onReload(): Promise<void> {
  if (reloadDisabled.value || !activeTabId.value) return;
  const api = electronApp();
  const tabId = activeTabId.value;
  if (!api?.reloadDocument) {
    showReloadTip('unreadable', RELOAD_UNREADABLE_TIP, false);
    console.warn('[markly] 重新加载没有通道');
    return;
  }
  reloading.value = true;
  try {
    const result = parseReloadResult(await api.reloadDocument());
    if (activeTabId.value !== tabId) return;
    console.info('[markly] 重新加载', { ok: result.ok, reason: result.ok ? '' : result.reason, file: activeFilePath.value });
    if (result.ok) showReloadTip('ok', RELOAD_OK_TIP, true);
    else if (result.reason === 'missing') showReloadTip('missing', RELOAD_MISSING_TIP, false);
    else if (result.reason === 'unreadable') showReloadTip('unreadable', RELOAD_UNREADABLE_TIP, false);
  } catch (err) {
    if (activeTabId.value !== tabId) return;
    showReloadTip('unreadable', RELOAD_UNREADABLE_TIP, false);
    console.warn('[markly] 重新加载失败', err);
  } finally {
    reloading.value = false;
  }
}

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

/** 没有 Markdown 标题、当前是 JSON、或正在看源码，就不显示目录。目录画在正文里面。 */
const hasOutline = computed(
  () =>
    !sourceOpen.value &&
    structuredKindFromName(activeFilePath.value) === null &&
    outline.value.length > 0
);

function jumpToHeading(headingId: string): void {
  frameRef.value?.contentWindow?.postMessage({ type: 'SCROLL_TO_HEADING', headingId }, '*');
}

const safeHtml = computed(() => buildPreviewSrcdoc(previewHtml.value));

/**
 * 每个标签缓存一份已渲染的预览，key 是标签 id，value 连正文一起存。
 * 正文变了就判缓存失效，所以切回旧标签是瞬时的，而改动过的文档不会拿到陈旧 HTML。
 */
const previewCache = new Map<string, { content: string; html: string }>();

function applyTabsView(raw: unknown): void {
  const view = parseTabsView(raw);
  const leaving = activeTabId.value;
  const arriving = view.activeId;
  if (leaving && leaving !== arriving) {
    if (!isSettingsTab.value) {
      const sync = sourceOpen.value ? captureSourceNow() : null;
      if (sync) putReading(leaving, { source: sourceOpen.value, anchor: sync });
      else putReading(leaving, { source: sourceOpen.value });
    }
    wantRestore = true;
  }
  tabs.value = view.tabs;
  activeTabId.value = view.activeId;
  // 关掉的标签不再占着缓存
  const alive = new Set(view.tabs.map((t) => t.id));
  for (const id of [...previewCache.keys()]) {
    if (!alive.has(id)) previewCache.delete(id);
  }
  for (const id of [...readingByTab.keys()]) {
    if (!alive.has(id)) readingByTab.delete(id);
  }
  if (reloadTip.value && !alive.has(reloadTip.value.tabId)) {
    reloadTip.value = null;
    clearReloadTipTimer();
  }
  syncSourceOpen();
}

/** 把所选配色写成根节点上的 CSS 变量，外壳（顶栏/标签条/侧栏/设置页）据此变色。 */
function applyShellPalette(): void {
  const palette = resolveEditorPalette(appearance.value.theme, appearance.value.prefersDark);
  applyEditorPalette(document.documentElement, palette);
}

function refreshAppearance(): void {
  try {
    const raw = electronApp()?.getAppearance?.();
    if (raw && typeof raw === 'object' && Array.isArray((raw as { systemFonts?: unknown }).systemFonts)) {
      systemFonts.value = parseSystemFontList((raw as { systemFonts: unknown }).systemFonts);
      systemFontsKnown.value = true;
    }
    appearance.value = parseAppearance(raw, systemFontsKnown.value ? systemFonts.value : undefined);
  } catch {
    /* 桥未就绪：留用默认外观 */
  }
  applyShellPalette();
}

async function refreshSystemFonts(): Promise<void> {
  const api = electronApp();
  if (!api?.listSystemFonts) return;
  try {
    systemFonts.value = parseSystemFontList(await api.listSystemFonts());
    systemFontsKnown.value = true;
    refreshAppearance();
  } catch (err) {
    console.warn('[markly] 读取系统字体失败', err);
  }
}

async function onUpdateAppearance(patch: Partial<AppearanceState>): Promise<void> {
  const next = await electronApp()?.updateAppearance?.(patch);
  if (next) appearance.value = parseAppearance(next);
  applyShellPalette();
  // 配色与字体都进了预览 HTML，旧缓存全部作废
  previewCache.clear();
}

function refreshReaderPrefs(): void {
  try {
    copyOnSelect.value = readReaderPrefs(electronApp()?.getReaderPrefs?.() ?? {}).copyOnSelect;
  } catch {
    copyOnSelect.value = true;
  }
}

async function onUpdateReader(patch: { copyOnSelect: boolean }): Promise<void> {
  const api = electronApp();
  if (!api?.updateReaderPrefs) {
    copyOnSelect.value = patch.copyOnSelect;
    return;
  }
  try {
    copyOnSelect.value = readReaderPrefs(await api.updateReaderPrefs(patch)).copyOnSelect;
  } catch (err) {
    console.warn('[markly] 保存「选择即复制」失败', err);
    copyOnSelect.value = patch.copyOnSelect;
  }
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

async function onActivateTab(id: string): Promise<void> {
  closeRecent();
  if (id === activeTabId.value || placeBusy) return;
  placeBusy = true;
  try {
    await rememberActivePlace();
  } finally {
    placeBusy = false;
  }
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

function onDocPointerDown(ev: MouseEvent): void {
  const target = ev.target instanceof Node ? ev.target : null;
  if (recentOpen.value) {
    // 透明层自己的点击负责收起，这里不再关第二次
    if (target instanceof Element && target.closest('.recent-dismiss')) return;
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

/**
 * 点进预览 iframe 时，父页面收不到 pointerdown，窗口会失焦，activeElement 变成这个 frame。
 * 延后一拍再看焦点，避免把普通失焦误当成“点了空白”。
 */
function onWindowBlur(): void {
  if (!recentOpen.value) return;
  if (blurCloseTimer) clearTimeout(blurCloseTimer);
  blurCloseTimer = setTimeout(() => {
    blurCloseTimer = null;
    if (!recentOpen.value) return;
    if (document.activeElement instanceof HTMLIFrameElement) closeRecent();
  }, 0);
}

/** 允许把文件放到窗口任意位置（不 preventDefault 的话 drop 不触发）。 */
function onDragOver(ev: DragEvent): void {
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
  ev.preventDefault();
}

/** 拖 Markdown / JSON / JSONL 进界面 → 自动打开；多份按拖入顺序逐个开标签。 */
async function onDrop(ev: DragEvent): Promise<void> {
  ev.preventDefault();
  const files = ev.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const paths = collectDroppedDocumentPaths(files as unknown as ArrayLike<DroppedFileLike>);
  for (const p of paths) {
    await electronApp()?.openPath?.(p);
  }
}

function flashCopyState(ok: boolean, hint = '已复制到剪贴板'): void {
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
  copiedHint.value = hint;
  copied.value = ok;
  copyFailed.value = !ok;
  if (ok) copiedTick.value += 1;
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copyFailed.value = false;
    copiedTimer = null;
  }, 1600);
}

/** 预览 iframe 里点中圆角框：只认当前预览窗口发来的复制消息。 */
function onBoxCopyMessage(ev: MessageEvent): void {
  const frameWindow = frameRef.value?.contentWindow ?? null;
  if (!frameWindow || ev.source !== frameWindow) return;
  const text = readBoxCopyPayload(ev.data);
  if (text === null) return;
  void copyBoxText(text);
}

async function copyBoxText(text: string): Promise<void> {
  const api = electronApp();
  if (!api?.copyExactText) {
    flashCopyState(false);
    return;
  }
  try {
    const ok = await api.copyExactText(text);
    flashCopyState(ok !== false, '已复制');
  } catch {
    flashCopyState(false);
  }
}

function flashSelectionToast(text: string): void {
  if (selectionToastTimer) {
    clearTimeout(selectionToastTimer);
    selectionToastTimer = null;
  }
  selectionToast.value = text;
  selectionToastTimer = setTimeout(() => {
    selectionToast.value = '';
    selectionToastTimer = null;
  }, 1200);
}

async function onSelectionCopyMessage(ev: MessageEvent): Promise<void> {
  const frame = frameRef.value?.contentWindow;
  const payload = acceptSelectionCopyMessage({
    enabled: copyOnSelect.value,
    fromPreviewFrame: !!frame && ev.source === frame,
    data: ev.data,
    documentText: visibleTextFromHtml(previewHtml.value),
  });
  if (!payload) return;
  const api = electronApp();
  if (!api?.copySelection) {
    flashSelectionToast('复制失败');
    console.warn('[markly] 选择即复制没有剪贴板通道');
    return;
  }
  try {
    const ok = await api.copySelection(payload);
    if (ok === false) {
      flashSelectionToast('复制失败');
      console.warn('[markly] 选择即复制被拒绝', { chars: payload.text.length });
      return;
    }
    flashSelectionToast('已复制');
    console.info('[markly] 已复制选中文字', { chars: payload.text.length });
  } catch (err) {
    flashSelectionToast('复制失败');
    console.warn('[markly] 选择即复制失败', err);
  }
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
    flashCopyState(ok !== false, '已复制到剪贴板（Markdown + 富文本）');
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
  if (wantRestore && !sourceOpen.value) {
    const anchor = readingOf(activeTabId.value).anchor;
    if (!anchor || postPreviewRestore(anchor)) wantRestore = false;
  }
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
      restoreArmedSource();
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
  void refreshSystemFonts();
  refreshReaderPrefs();
  window.addEventListener('message', onSelectionCopyMessage);
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
  window.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('mousedown', onDocPointerDown);
  window.addEventListener('keydown', onDocKeydown);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);
  window.addEventListener('message', onBoxCopyMessage);
  postMessage({ type: 'READY', payload: undefined });
});

onUnmounted(() => {
  off();
  offCopyRequest?.();
  offTabsChanged?.();
  window.removeEventListener('message', onSelectionCopyMessage);
  window.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('mousedown', onDocPointerDown);
  window.removeEventListener('keydown', onDocKeydown);
  window.removeEventListener('blur', onWindowBlur);
  document.removeEventListener('dragover', onDragOver);
  document.removeEventListener('drop', onDrop);
  window.removeEventListener('message', onBoxCopyMessage);
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
  clearReloadTipTimer();
  clearExportCloseTimer();
  if (exportHintTimer) {
    clearTimeout(exportHintTimer);
    exportHintTimer = null;
  }
  if (selectionToastTimer) {
    clearTimeout(selectionToastTimer);
    selectionToastTimer = null;
  }
  if (blurCloseTimer) {
    clearTimeout(blurCloseTimer);
    blurCloseTimer = null;
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
  /* 按钮、菜单、文件树用系统字体。正文字体只加在预览和设置里的示例上。 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
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
  border-radius: var(--app-radius-sm);
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
  border-radius: var(--app-radius-sm);
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
  z-index: 40;
  display: flex;
  align-items: stretch;
  align-self: center;
  min-width: 0;
}
/* 盖住预览 iframe 与侧栏空白；低于按钮和菜单，点菜单本身不会被这层截走 */
.recent-dismiss {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: transparent;
  cursor: default;
}
.open-split .open-main,
.open-split .open-caret {
  position: relative;
  z-index: 2;
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
.tab-reload {
  align-self: center;
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  margin-right: 4px;
  font-size: 12px;
}
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
.tab-source {
  align-self: center;
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  margin-right: 4px;
  font-size: 12px;
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
.tab-copy-icon,
.tab-copy-mark {
  width: 15px;
  height: 15px;
  display: block;
  overflow: visible;
}
.tab-copy-icon rect,
.tab-copy-icon path,
.tab-copy-mark path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tab-copy-mark path {
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
  justify-content: center;
  gap: 4px;
  height: 26px;
  min-height: 26px;
  min-width: 76px;
  box-sizing: border-box;
  padding: 0 8px;
  font-size: 12px;
}
.tab-settings {
  align-self: center;
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  margin-right: 4px;
  font-size: 12px;
}
.export-caret {
  font-size: 10px;
  line-height: 1;
  opacity: 0.75;
}
/* 打开时和按钮合成一块：同宽、左右对齐，相接的一边不留缝、不留横框。圆角只在外轮廓。 */
.export-split:has(.export-menu) {
  z-index: 40;
}
.export-split:has(.export-menu) .tab-export,
.export-split:has(.export-menu) .tab-export:hover {
  border-radius: var(--app-radius-sm) var(--app-radius-sm) 0 0;
  border-bottom-color: var(--markly-background, #fff);
  background: var(--markly-background, #fff);
}
.export-menu {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  z-index: 30;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-top: 0;
  border-radius: 0 0 var(--app-radius-sm) var(--app-radius-sm);
  background: var(--markly-background, #fff);
  box-shadow: none;
  overflow: hidden;
}
.export-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  white-space: nowrap;
  border: 0;
  background: transparent;
  color: var(--markly-text, #24292e);
  font-size: 12px;
  line-height: 1.35;
  padding: 6px 4px;
  border-radius: 0;
  cursor: pointer;
}
.export-item:hover { background: var(--markly-surfaceHover, #eaeef2); }

.preview-area {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--markly-background, #fff);
}
.preview-stage {
  flex: 1 1 auto;
  display: flex;
  min-width: 0;
  min-height: 0;
}
.preview-stage > .settings-page {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: auto;
}
.reload-tip {
  flex: 0 0 auto;
  margin: 0;
  padding: 8px 16px;
  font-size: 13px;
  line-height: 1.45;
  border-bottom: 1px solid transparent;
  animation: reload-tip-in 220ms ease-out;
}
.reload-tip.is-ok {
  color: #1a7f37;
  background: #dafbe1;
  border-bottom-color: #aceebb;
}
.reload-tip.is-missing,
.reload-tip.is-unreadable {
  color: #7d4e00;
  background: #fff8c5;
  border-bottom-color: #eac54f;
}
:global(html[data-theme='dark']) .reload-tip.is-ok {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.18);
  border-bottom-color: rgba(63, 185, 80, 0.4);
}
:global(html[data-theme='dark']) .reload-tip.is-missing,
:global(html[data-theme='dark']) .reload-tip.is-unreadable {
  color: #d29922;
  background: rgba(210, 153, 34, 0.18);
  border-bottom-color: rgba(210, 153, 34, 0.45);
}
@keyframes reload-tip-in {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .reload-tip { animation: none; }
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
  border-radius: var(--app-radius-sm);
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
  margin: 0 6px;
  border-radius: var(--app-radius-sm);
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
/* 源码用等宽字体，不套预览正文的思源黑体。字号跟阅读设置走。 */
.blank-page {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px 40px 32px;
  min-width: 0;
  min-height: 0;
}
.blank-open {
  min-width: 72px;
  font-size: 13px;
}
.blank-hint {
  margin: 0;
  max-width: 28em;
  font-size: 13px;
  line-height: 1.5;
  color: var(--markly-textSecondary, #57606a);
}
.source-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--markly-background, #fff);
}
.source-note {
  flex: 0 0 auto;
  margin: 0;
  padding: 10px 20px;
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
  font-size: 12px;
  line-height: 1.4;
  color: var(--markly-textSecondary, #57606a);
}
.source-view {
  flex: 1;
  margin: 0;
  padding: 16px 20px;
  overflow: auto;
  min-height: 0;
  box-sizing: border-box;
  white-space: pre;
  tab-size: 2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  line-height: 1.55;
  color: var(--markly-text, #24292e);
  background: var(--markly-background, #fff);
}
.selection-toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 12px;
  border-radius: var(--app-radius-pill);
  background: var(--markly-text, #24292e);
  color: var(--markly-background, #fff);
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  z-index: 2;
}
.status { padding: 24px; color: var(--markly-textSecondary, #666); }
.status.error { color: var(--markly-error, #d33); }
</style>