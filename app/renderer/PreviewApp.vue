<template>
  <div
    class="markly-app"
    :style="appChromeStyle"
    :class="{
      'files-collapsed': fileTreeCollapsed,
      'word-wrap': wordWrap,
      'is-resizing': filesResizing,
    }"
  >
    <div ref="openSplitRef" class="open-rail">
      <div v-if="!fileTreeCollapsed" class="open-split">
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
      <div class="file-tree-chrome">
        <button
          v-if="!fileTreeCollapsed"
          type="button"
          class="file-icon-btn file-up"
          title="上一级目录"
          aria-label="上一级目录"
          :disabled="!treeCanGoUp"
          @click="onGoUp"
        >
          <!-- 系统字体的 ↑ 线条太细，改成描边箭头，线宽自己定。 -->
          <svg class="file-up-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 13.2V3.6M3.7 8 8 3.6 12.3 8" />
          </svg>
        </button>
        <button
          v-if="!fileTreeCollapsed"
          type="button"
          class="file-icon-btn"
          title="刷新目录树"
          aria-label="刷新目录树"
          :disabled="!treeHasRoot"
          @click="onRefreshTree"
        >刷新</button>
        <button
          class="file-toggle"
          type="button"
          :title="fileTreeCollapsed ? '展开文件' : '收起文件'"
          :aria-label="fileTreeCollapsed ? '展开文件' : '收起文件'"
          :aria-expanded="!fileTreeCollapsed"
          @click="toggleFileTree"
        >{{ fileTreeCollapsed ? '›' : '‹' }}</button>
      </div>
    </div>
    <TabBar
      :tabs="tabs"
      :active-id="activeTabId"
      @activate="onActivateTab"
      @close="onCloseTab"
      @new="onNewTab"
    >
      <template #tools>
        <button
          v-if="editing"
          class="chrome-btn tab-icon tab-undo"
          type="button"
          :disabled="!canUndo"
          title="回退"
          aria-label="回退"
          @click="onUndo"
        >
          <svg class="chrome-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.2 3.4 3 6.6l3.2 3.2" />
            <path d="M3.2 6.6h6.1a3.3 3.3 0 1 1 0 6.6H8" />
          </svg>
        </button>
        <button
          v-if="editing"
          class="chrome-btn tab-icon tab-redo"
          type="button"
          :disabled="!canRedo"
          title="重做"
          aria-label="重做"
          @click="onRedo"
        >
          <svg class="chrome-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M9.8 3.4 13 6.6 9.8 9.8" />
            <path d="M12.8 6.6H6.7a3.3 3.3 0 1 0 0 6.6H8" />
          </svg>
        </button>
        <button
          v-if="editing"
          class="chrome-btn tab-save"
          type="button"
          :disabled="!activeDirty || saving"
          title="保存（Cmd/Ctrl+S）"
          aria-label="保存"
          @click="onSave"
        >保存</button>
        <button
          class="chrome-btn tab-source"
          type="button"
          :disabled="isSettingsTab"
          :class="{ active: sourceOpen }"
          :title="sourceTitle"
          :aria-label="sourceTitle"
          :aria-pressed="sourceOpen"
          @click="toggleSource"
        >
          <svg v-if="sourceOpen" class="chrome-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.6 8s2.2-3.6 6.4-3.6S14.4 8 14.4 8s-2.2 3.6-6.4 3.6S1.6 8 1.6 8z" />
            <circle cx="8" cy="8" r="1.6" />
          </svg>
          <svg v-else class="chrome-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 2.8 8 6 12.5M10 3.5 13.2 8 10 12.5" />
          </svg>
          <span>{{ sourceLabel }}</span>
        </button>
        <button
          class="chrome-btn tab-reload"
          type="button"
          :disabled="reloadDisabled"
          :title="reloadTitle"
          :aria-label="reloadTitle"
          @click="onReload"
        >刷新</button>
        <button
          class="chrome-btn tab-edit"
          type="button"
          :disabled="isSettingsTab"
          :class="{ active: editing }"
          :title="editTitle"
          :aria-label="editTitle"
          :aria-pressed="editing"
          @click="toggleEdit"
        >编辑</button>
        <div
          ref="exportSplitRef"
          class="actions-split"
          @mouseenter="onExportEnter"
          @mouseleave="onExportLeave"
        >
          <button
            class="chrome-btn tab-actions"
            type="button"
            :title="exportOpen ? '' : actionsTitle"
            aria-label="菜单"
            aria-haspopup="menu"
            :aria-expanded="exportOpen"
            aria-controls="actions-menu"
            @click="onExportButtonClick"
          >
            <svg class="actions-dots" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>
          <div v-if="exportOpen" id="actions-menu" class="actions-menu" role="menu" aria-label="菜单">
            <button
              type="button"
              class="action-item"
              role="menuitem"
              data-format="pdf"
              data-action="pdf"
              :disabled="exporting || isSettingsTab"
              @click="onPickExport('pdf')"
            >导出 PDF</button>
            <button
              type="button"
              class="action-item"
              role="menuitem"
              data-format="html"
              data-action="html"
              :disabled="exporting || isSettingsTab"
              @click="onPickExport('html')"
            >导出 HTML</button>
            <button
              class="action-item tab-settings"
              type="button"
              role="menuitem"
              data-action="settings"
              title="设置（Cmd/Ctrl+,）"
              aria-label="设置"
              :class="{ active: isSettingsTab }"
              @click="onOpenSettings"
            >设置</button>
          </div>
        </div>
      </template>
    </TabBar>
    <div
      v-if="!fileTreeCollapsed"
      class="files-resize"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label="调整文件树宽度"
      title="拖动调整宽度，双击恢复默认"
      :aria-valuemin="currentFileTreeLimit().min"
      :aria-valuemax="currentFileTreeLimit().max"
      :aria-valuenow="fileTreeWidth"
      @pointerdown="onFilesResizeDown"
      @dblclick="onFilesResizeReset"
      @keydown="onFilesResizeKey"
    />
    <FileTree
      ref="fileTreeRef"
      :collapsed="fileTreeCollapsed"
      :active-path="activeFilePath"
      @chrome="onFileTreeChrome"
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
        :word-wrap="wordWrap"
        :max-open-tabs="maxOpenTabs"
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
          <div v-if="isBlankDoc && !sourceOpen && !editing" class="blank-page">
            <h1 class="welcome-title">{{ WELCOME_TITLE }}</h1>
            <p class="welcome-lead">{{ WELCOME_LEAD }}</p>
            <p v-for="line in WELCOME_LINES" :key="line" class="welcome-line">{{ line }}</p>
            <div class="welcome-meta">
              <p class="welcome-meta-row">
                <span class="welcome-meta-label">{{ WELCOME_REPO_LABEL }}</span>
                <button type="button" class="welcome-link" @click="openWelcomeRepo">{{ WELCOME_REPO }}</button>
              </p>
              <p class="welcome-meta-row">
                <span class="welcome-meta-label">{{ WELCOME_EMAIL_LABEL }}</span>
                <span class="welcome-email">{{ WELCOME_EMAIL }}</span>
              </p>
            </div>
          </div>
          <div v-else-if="editing" class="edit-pane">
            <p v-if="editNote" class="source-note">{{ editNote }}</p>
            <div ref="editHost" class="edit-host"></div>
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
          <button
            class="doc-copy tab-copy"
            :class="{ 'is-copied': copied, 'is-failed': copyFailed }"
            type="button"
            :disabled="copying"
            :title="copyTitle"
            :aria-label="copyTitle"
            @click="onCopy"
          >
            <span class="action-icon" :key="copiedTick">
              <svg v-if="copied" class="tab-copy-mark" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.4 8.2 6.5 11.3 12.7 4.7" />
              </svg>
              <svg v-else class="tab-copy-icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="5.333" y="5.333" width="9.333" height="9.333" rx="1.333" ry="1.333" />
                <path d="M2.667 10.667c-.733 0-1.333-.6-1.333-1.333V2.667c0-.733.6-1.333 1.333-1.333h6.667c.733 0 1.333.6 1.333 1.333" />
              </svg>
            </span>
          </button>
        </div>
      </template>
      </div>
      <p v-if="selectionToast" class="selection-toast" role="status">{{ selectionToast }}</p>
    </main>
    <ClickBurstLayer />
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
import { editingOriginalNote, formatDocumentSource, sourceFormatNote } from '../electron/sourceText';
import { parseSaveResult } from '../electron/saveResult';
import { mountSourceEditor, type SourceEditorHandle } from './sourceEditor';
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
import { DEFAULT_MAX_OPEN_TABS, readReaderPrefs } from '../electron/readerPrefs';
import {
  WELCOME_EMAIL,
  WELCOME_EMAIL_LABEL,
  WELCOME_LEAD,
  WELCOME_LINES,
  WELCOME_REPO,
  WELCOME_REPO_LABEL,
  WELCOME_TITLE,
} from '../electron/tabs';
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
import {
  FILE_TREE_DEFAULT_WIDTH,
  clampFileTreeWidth,
  fileTreeWidthLimit,
  readStoredFileTreeWidth,
  resizeDragMove,
} from './fileTreeWidth';
import FileTree from './FileTree.vue';
import RecentFilesMenu from './RecentFilesMenu.vue';
import SettingsPage from './SettingsPage.vue';
import TabBar from './TabBar.vue';
import ClickBurstLayer from './ClickBurstLayer.vue';

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
const fileTreeWidth = ref(FILE_TREE_DEFAULT_WIDTH);
const filesResizing = ref(false);
function currentFileTreeLimit(): { min: number; max: number } {
  return fileTreeWidthLimit(window.innerWidth || 0);
}
const appChromeStyle = computed(() => {
  const style: Record<string, string> = { ...chromeRadiusStyle };
  if (!fileTreeCollapsed.value) style['--files-col'] = `${fileTreeWidth.value}px`;
  return style;
});
let filesResizeMove: ((ev: PointerEvent) => void) | null = null;
let filesResizeUp: ((ev: PointerEvent) => void) | null = null;
const treeCanGoUp = ref(false);
const treeHasRoot = ref(false);
const fileTreeRef = ref<{ goUp: () => Promise<void>; refresh: () => Promise<void> } | null>(null);
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
const wordWrap = ref(true);
const maxOpenTabs = ref(DEFAULT_MAX_OPEN_TABS);
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

const actionsTitle = computed(() => {
  if (exporting.value) return '正在导出…';
  if (exportHint.value) return exportHint.value;
  return '菜单';
});

/**
 * 每个文档标签各自记住：在看源码还是预览，以及视口上方附近的那一句。
 * 关掉标签就忘掉。高度两边不一样，所以记的是文字，不是一个像素。
 */
interface TabReading {
  source: boolean;
  editing: boolean;
  anchor: PlaceAnchor | null;
}

const readingByTab = new Map<string, TabReading>();
const sourceOpen = ref(false);
/** 切标签或切回预览之后，等正文到了再滚回记下的那一句。 */
let wantRestore = false;
let placeBusy = false;

const sourceLabel = computed(() => (sourceOpen.value ? '预览' : '源码'));

const sourceTitle = computed(() => {
  if (isSettingsTab.value) return '设置页没有源码';
  return sourceOpen.value ? '预览' : '查看源码';
});

const sourceText = computed(() => formatDocumentSource(markdownContent.value, activeFilePath.value));
const sourceNote = computed(() => sourceFormatNote(markdownContent.value, activeFilePath.value));
const editNote = computed(() => editingOriginalNote(activeFilePath.value));
const editing = ref(false);
const editHost = ref<HTMLElement | null>(null);
const canUndo = ref(false);
const canRedo = ref(false);
const saving = ref(false);
const editors = new Map<string, SourceEditorHandle>();
const activeDirty = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value)?.dirty === true
);
const editTitle = computed(() => {
  if (isSettingsTab.value) return '设置页不能编辑';
  return editing.value ? '结束编辑' : '编辑原文';
});

function readingOf(id: string): TabReading {
  return readingByTab.get(id) ?? { source: false, editing: false, anchor: null };
}

function putReading(id: string, patch: Partial<TabReading>): void {
  if (!id) return;
  readingByTab.set(id, { ...readingOf(id), ...patch });
}

function syncSourceOpen(): void {
  if (isSettingsTab.value || !activeTabId.value) {
    sourceOpen.value = false;
    editing.value = false;
    return;
  }
  sourceOpen.value = readingOf(activeTabId.value).source;
  editing.value = readingOf(activeTabId.value).editing && !sourceOpen.value;
}

function refreshHistory(editor: SourceEditorHandle | undefined): void {
  const history = editor?.history() ?? { canUndo: false, canRedo: false };
  canUndo.value = history.canUndo;
  canRedo.value = history.canRedo;
}

function onEditorChange(text: string, history: { canUndo: boolean; canRedo: boolean }): void {
  canUndo.value = history.canUndo;
  canRedo.value = history.canRedo;
  if (text === markdownContent.value) return;
  markdownContent.value = text;
  postMessage({ type: 'CONTENT_CHANGE', payload: { content: text, version: Date.now() } });
}

/** 把当前标签的编辑器接到页面上。正文若从磁盘换过，就新建一份，撤销步骤清空。 */
function syncEditor(focus: boolean): void {
  const host = editHost.value;
  const id = activeTabId.value;
  if (!editing.value || !host || !id) return;
  for (const [otherId, other] of editors) {
    if (otherId !== id) other.dom.remove();
  }
  let editor = editors.get(id);
  const same = editor && editor.getContent() === markdownContent.value;
  if (!editor || !same) {
    editor?.destroy();
    editor = mountSourceEditor(
      host,
      markdownContent.value,
      appearance.value.fontSize,
      onEditorChange,
      wordWrap.value
    );
    editors.set(id, editor);
    if (focus) editor.focus();
  } else if (editor.dom.parentElement !== host) {
    host.appendChild(editor.dom);
    if (focus) editor.focus();
  }
  refreshHistory(editor);
}

function destroyEditor(id: string): void {
  editors.get(id)?.destroy();
  editors.delete(id);
}

async function leaveEdit(): Promise<boolean> {
  if (!editing.value || !activeTabId.value) return true;
  const id = activeTabId.value;
  const api = electronApp();
  const settled = api?.settleEdits ? await api.settleEdits() : 'clean';
  if (settled === 'cancel') return false;
  editors.get(id)?.dom.remove();
  putReading(id, { editing: false });
  if (activeTabId.value === id) editing.value = false;
  requestPreview();
  return true;
}

async function toggleEdit(): Promise<void> {
  closeExportMenu();
  if (isSettingsTab.value || !activeTabId.value) return;
  const id = activeTabId.value;
  if (editing.value) {
    await leaveEdit();
    return;
  }
  if (sourceOpen.value) {
    putReading(id, { source: false, editing: true });
    sourceOpen.value = false;
  } else {
    putReading(id, { editing: true });
  }
  editing.value = true;
  console.info('[markly] 进入编辑', { file: activeFilePath.value });
  await nextTick();
  syncEditor(true);
}

function onUndo(): void {
  const editor = editors.get(activeTabId.value);
  if (!editing.value || !editor) return;
  editor.undo();
}

function onRedo(): void {
  const editor = editors.get(activeTabId.value);
  if (!editing.value || !editor) return;
  editor.redo();
}

async function onSave(): Promise<void> {
  if (!editing.value || saving.value) return;
  const api = electronApp();
  if (!api?.saveDocument) {
    showReloadTip('unreadable', '没能保存，屏幕上的字还在', false);
    return;
  }
  saving.value = true;
  try {
    const result = parseSaveResult(await api.saveDocument());
    console.info('[markly] 保存', { ok: result.ok, file: activeFilePath.value });
    if (result.ok) showReloadTip('ok', '已保存', true);
    else if (result.reason === 'failed') showReloadTip('unreadable', result.message || '没能保存，屏幕上的字还在', false);
    else if (result.reason === 'reloaded') showReloadTip('unreadable', result.message || '已重新打开磁盘上的版本', false);
  } catch (err) {
    showReloadTip('unreadable', '没能保存，屏幕上的字还在', false);
    console.warn('[markly] 保存失败', err);
  } finally {
    saving.value = false;
  }
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
  if (editing.value) {
    const stayed = !(await leaveEdit());
    if (stayed) return;
  }
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
  kind: 'ok' | 'missing' | 'unreadable' | 'warn';
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
  closeExportMenu();
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
    if (!result.ok && result.reason === 'cancelled') return;
    if (result.ok) {
      destroyEditor(tabId);
      showReloadTip('ok', RELOAD_OK_TIP, true);
    } else if (result.reason === 'missing') showReloadTip('missing', RELOAD_MISSING_TIP, false);
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
  if (editing.value) {
    const item = outline.value.find((heading) => heading.id === headingId);
    if (item) editors.get(activeTabId.value)?.reveal(item.from);
    return;
  }
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
  const switched = Boolean(leaving && leaving !== arriving);
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
  for (const id of [...editors.keys()]) {
    if (!alive.has(id)) destroyEditor(id);
    else if (switched) editors.get(id)?.dom.remove();
  }
  if (reloadTip.value && !alive.has(reloadTip.value.tabId)) {
    reloadTip.value = null;
    clearReloadTipTimer();
  }
  syncSourceOpen();
  // 换标签时正文还是上一份，等 CONTENT_UPDATE 到了再接编辑器，避免把撤销步骤清掉。
  if (editing.value && !switched) void nextTick(() => syncEditor(false));
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
    const prefs = readReaderPrefs(electronApp()?.getReaderPrefs?.() ?? {});
    copyOnSelect.value = prefs.copyOnSelect;
    wordWrap.value = prefs.wordWrap;
    maxOpenTabs.value = prefs.maxOpenTabs;
  } catch {
    copyOnSelect.value = true;
    wordWrap.value = true;
    maxOpenTabs.value = DEFAULT_MAX_OPEN_TABS;
  }
}

async function onUpdateReader(patch: {
  copyOnSelect?: boolean;
  wordWrap?: boolean;
  maxOpenTabs?: number;
}): Promise<void> {
  const api = electronApp();
  const apply = (prefs: { copyOnSelect: boolean; wordWrap: boolean; maxOpenTabs: number }): void => {
    copyOnSelect.value = prefs.copyOnSelect;
    wordWrap.value = prefs.wordWrap;
    maxOpenTabs.value = prefs.maxOpenTabs;
  };
  if (!api?.updateReaderPrefs) {
    apply({
      copyOnSelect: patch.copyOnSelect ?? copyOnSelect.value,
      wordWrap: patch.wordWrap ?? wordWrap.value,
      maxOpenTabs: patch.maxOpenTabs ?? maxOpenTabs.value,
    });
  } else {
    try {
      apply(readReaderPrefs(await api.updateReaderPrefs(patch)));
    } catch (err) {
      console.warn('[markly] 保存阅读设置失败', err);
      apply({
        copyOnSelect: patch.copyOnSelect ?? copyOnSelect.value,
        wordWrap: patch.wordWrap ?? wordWrap.value,
        maxOpenTabs: patch.maxOpenTabs ?? maxOpenTabs.value,
      });
    }
  }
  if (patch.wordWrap !== undefined) {
    previewCache.clear();
    requestPreview();
  }
}

function onOpenSettings(): void {
  closeExportMenu();
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
  if (fileTreeCollapsed.value) {
    closeRecent();
    stopFilesResize();
  }
  try {
    electronApp()?.storeSet?.('fileTreeCollapsed', fileTreeCollapsed.value);
  } catch {
    /* ignore */
  }
}

function persistFileTreeWidth(): void {
  try {
    electronApp()?.storeSet?.('fileTreeWidth', fileTreeWidth.value);
  } catch {
    /* ignore */
  }
}

function stopFilesResize(): void {
  if (filesResizeMove) window.removeEventListener('pointermove', filesResizeMove);
  if (filesResizeUp) {
    window.removeEventListener('pointerup', filesResizeUp);
    window.removeEventListener('pointercancel', filesResizeUp);
  }
  filesResizeMove = null;
  filesResizeUp = null;
  filesResizing.value = false;
}

function onFilesResizeDown(ev: PointerEvent): void {
  if (ev.button !== 0 || fileTreeCollapsed.value) return;
  ev.preventDefault();
  stopFilesResize();
  const startX = ev.clientX;
  const startWidth = fileTreeWidth.value;
  filesResizing.value = true;
  const move = (e: PointerEvent): void => {
    fileTreeWidth.value = resizeDragMove(startWidth, startX, e.clientX, window.innerWidth || 0);
  };
  const up = (e: PointerEvent): void => {
    move(e);
    stopFilesResize();
    persistFileTreeWidth();
  };
  filesResizeMove = move;
  filesResizeUp = up;
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function onFilesResizeReset(): void {
  fileTreeWidth.value = clampFileTreeWidth(FILE_TREE_DEFAULT_WIDTH, window.innerWidth || 0);
  persistFileTreeWidth();
}

function onFilesResizeKey(ev: KeyboardEvent): void {
  const available = window.innerWidth || 0;
  const limit = fileTreeWidthLimit(available);
  const step = ev.shiftKey ? 32 : 16;
  let next = fileTreeWidth.value;
  if (ev.key === 'ArrowLeft') next -= step;
  else if (ev.key === 'ArrowRight') next += step;
  else if (ev.key === 'Home') next = limit.min;
  else if (ev.key === 'End') next = limit.max;
  else return;
  ev.preventDefault();
  fileTreeWidth.value = clampFileTreeWidth(next, available);
  persistFileTreeWidth();
}

function onFileTreeChrome(state: { canGoUp: boolean; hasRoot: boolean }): void {
  treeCanGoUp.value = state.canGoUp;
  treeHasRoot.value = state.hasRoot;
}

function onGoUp(): void {
  void fileTreeRef.value?.goUp();
}

function onRefreshTree(): void {
  void fileTreeRef.value?.refresh();
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
  if (activeDirty.value) {
    showReloadTip('warn', '导出的是还没保存的修改，文件本身还没变。', true);
  }
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

function openWelcomeRepo(): void {
  postMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: WELCOME_REPO } });
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
      if (editing.value) void nextTick(() => syncEditor(false));
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

const offEditCommand = electronApp()?.onEditCommand?.((command) => {
  if (command === 'save') {
    if (editing.value) void onSave();
    return;
  }
  if (command !== 'undo' && command !== 'redo') return;
  const editor = editors.get(activeTabId.value);
  if (editing.value && editor) {
    if (command === 'undo') editor.undo();
    else editor.redo();
    return;
  }
  document.execCommand(command);
});

const offTabsChanged = electronApp()?.onTabsChanged?.((view) => {
  applyTabsView(view);
});

watch(isSettingsTab, (isSettings) => {
  if (isSettings) closeExportMenu();
});

watch(editing, (on) => {
  electronApp()?.setEditing?.(on);
});

watch(
  () => appearance.value.fontSize,
  (px) => {
    editors.get(activeTabId.value)?.setFontSize(px);
  }
);

watch(wordWrap, (on) => {
  for (const editor of editors.values()) editor.setWordWrap(on);
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
  try {
    fileTreeWidth.value = readStoredFileTreeWidth(
      electronApp()?.storeGet?.('fileTreeWidth'),
      window.innerWidth || 0
    );
  } catch {
    fileTreeWidth.value = FILE_TREE_DEFAULT_WIDTH;
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
  offEditCommand?.();
  offTabsChanged?.();
  for (const id of [...editors.keys()]) destroyEditor(id);
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
  stopFilesResize();
});
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.markly-app {
  /* 打开和上一级、刷新目录、收起要排在同一栏，220 会挤出去盖住标签。 */
  --files-col: 260px;
  --chrome-row: 40px;
  /* 按钮、菜单、文件树用系统字体。正文字体只加在预览和设置里的示例上。 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  display: grid;
  /* 1fr 实际是 minmax(auto, 1fr)。内容一宽或文件树一长，整页就会被撑开，
     横向滚动条从文件树底下一直拉到正文。写成 minmax(0, 1fr)，两边各自滚。 */
  grid-template-columns: var(--files-col) minmax(0, 1fr);
  grid-template-rows: var(--chrome-row) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
/* 收起后树和「打开」都拿掉，这一列只留展开箭头，宽度跟着这颗按钮走。 */
.markly-app.files-collapsed { --files-col: max-content; }
.markly-app.is-resizing {
  cursor: col-resize;
  user-select: none;
}
.markly-app.is-resizing iframe { pointer-events: none; }
.markly-app > .tab-bar {
  position: relative;
  z-index: 20;
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: hidden;
}
.files-resize {
  grid-column: 1;
  grid-row: 1 / -1;
  justify-self: end;
  align-self: stretch;
  width: 8px;
  margin-right: -4px;
  z-index: 35;
  cursor: col-resize;
  touch-action: none;
  position: relative;
}
.files-resize::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
}
.files-resize:hover::after,
.markly-app.is-resizing .files-resize::after {
  background: var(--markly-primary, #0969da);
}
/* 打开按钮留在文件树正上方，右边是目录操作。标签从文件树右缘开始。 */
.open-rail {
  grid-column: 1;
  grid-row: 1;
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
  overflow: hidden;
  padding: 0 8px;
  box-sizing: border-box;
  background: var(--markly-surface, #f6f8fa);
  border-right: 1px solid var(--markly-border-color, #d0d7de);
  border-bottom: 1px solid var(--markly-border-color, #d0d7de);
}
.file-tree-chrome {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.file-icon-btn,
.file-toggle {
  box-sizing: border-box;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-sm);
  background: var(--markly-background, #fff);
  color: var(--markly-text, #24292e);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.3;
  height: 32px;
  padding: 0 8px;
  flex-shrink: 0;
}
/* 几乎方的小图标。宽的「刷新目录」仍用上面的 12px。高度跟打开按钮对齐。 */
.file-up,
.file-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-xxs);
  width: 32px;
  padding: 0;
}
.file-up-icon {
  width: 16px;
  height: 16px;
  display: block;
  overflow: visible;
}
.file-up-icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.file-icon-btn:hover,
.file-toggle:hover {
  background: var(--markly-surface, #f6f8fa);
}
.file-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.markly-app.files-collapsed .open-rail {
  justify-content: center;
  min-width: 0;
  gap: 0;
  padding: 0 4px;
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
/* 按下时略缩一下，表示点到了。字跟着水波晃靠滤镜，不靠这个缩放。 */
.chrome-btn,
.file-icon-btn,
.file-toggle,
.tab-new,
.tab-close,
.doc-outline-toggle {
  transition: transform 90ms ease-out;
}
.chrome-btn:active:not(:disabled),
.file-icon-btn:active:not(:disabled),
.file-toggle:active:not(:disabled),
.tab-new:active,
.tab-close:active,
.doc-outline-toggle:active {
  transform: scale(0.96);
}
.doc-copy:active:not(:disabled) {
  transform: scale(0.96);
}
/* 打开是左右拼在一起的，一缩接缝就会裂开。 */
.chrome-btn.open-main:active,
.chrome-btn.open-caret:active {
  transform: none;
}
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
.tab-source,
.tab-save,
.tab-reload,
.tab-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: center;
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  font-size: 12px;
}
.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 28px;
  min-width: 28px;
  height: 26px;
  min-height: 26px;
  padding: 0;
}
.tab-icon:disabled { opacity: 0.4; cursor: default; }
.chrome-glyph {
  width: 15px;
  height: 15px;
  display: block;
  overflow: visible;
}
.chrome-glyph path,
.chrome-glyph circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
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
  .chrome-btn,
  .file-icon-btn,
  .file-toggle,
  .tab-new,
  .tab-close,
  .doc-outline-toggle {
    transition: none;
  }
  .chrome-btn:active,
  .file-icon-btn:active,
  .file-toggle:active,
  .tab-new:active,
  .tab-close:active,
  .doc-outline-toggle:active,
  .doc-copy:active {
    transform: none;
  }
}
/* 最右侧三个竖点。菜单按最长一行自己定宽，右对齐浮在按钮下面。 */
.actions-split {
  position: relative;
  align-self: center;
  display: inline-flex;
}
.actions-split::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 10px;
}
.tab-actions {
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  min-width: 28px;
  max-width: 28px;
  height: 28px;
  min-height: 28px;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
}
.tab-actions:hover,
.actions-split:has(.actions-menu) .tab-actions,
.actions-split:has(.actions-menu) .tab-actions:hover {
  background: rgba(31, 35, 40, 0.08);
}
:global(html[data-theme='dark']) .tab-actions:hover,
:global(html[data-theme='dark']) .actions-split:has(.actions-menu) .tab-actions,
:global(html[data-theme='dark']) .actions-split:has(.actions-menu) .tab-actions:hover {
  background: rgba(255, 255, 255, 0.12);
}
.actions-dots {
  width: 18px;
  height: 18px;
  display: block;
  flex: 0 0 auto;
}
.actions-dots circle { fill: currentColor; }
.actions-split:has(.actions-menu) {
  z-index: 40;
}
.actions-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: auto;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-sizing: border-box;
  width: max-content;
  margin: 0;
  padding: 6px 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-md);
  background: var(--markly-background, #fff);
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
  overflow: hidden;
}
.action-item {
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 8px;
  box-sizing: border-box;
  text-align: left;
  white-space: nowrap;
  border: 0;
  background: transparent;
  color: var(--markly-text, #24292e);
  font-size: 12px;
  line-height: 1.35;
  padding: 8px 16px;
  border-radius: 0;
  cursor: pointer;
}
.action-item:hover { background: var(--markly-surfaceHover, #eaeef2); }
.action-item:disabled { opacity: 0.45; cursor: default; }
.action-item.active { color: var(--markly-primary, #0969da); }

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
  overflow: hidden;
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
.reload-tip.is-unreadable,
.reload-tip.is-warn {
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
:global(html[data-theme='dark']) .reload-tip.is-unreadable,
:global(html[data-theme='dark']) .reload-tip.is-warn {
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
.doc-copy {
  position: absolute;
  top: 12px;
  right: 12px;
  transition: transform 90ms ease-out;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--markly-border-color, #d0d7de);
  border-radius: var(--app-radius-sm);
  background: color-mix(in srgb, var(--markly-background, #fff) 92%, transparent);
  color: var(--markly-textSecondary, #57606a);
  cursor: pointer;
}
.doc-copy:hover { background: var(--markly-surfaceHover, #eaeef2); color: var(--markly-text, #24292e); }
@media (prefers-reduced-motion: reduce) {
  .doc-copy { transition: none; }
  .doc-copy:active { transform: none; }
}
.preview-frame {
  position: absolute;
  inset: 0;
  display: block;
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
  justify-content: flex-start;
  gap: 14px;
  padding: 56px 64px;
  min-width: 0;
  min-height: 0;
}
.welcome-title {
  margin: 0;
  font-size: 28px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--markly-text, #1f2328);
}
.welcome-lead,
.welcome-line {
  margin: 0;
  max-width: 36em;
  font-size: 15px;
  line-height: 1.7;
  color: var(--markly-textSecondary, #57606a);
}
.welcome-lead {
  font-size: 16px;
  color: var(--markly-text, #1f2328);
}
.welcome-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.welcome-meta-row {
  margin: 0;
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 14px;
  line-height: 1.6;
  color: var(--markly-textSecondary, #57606a);
}
.welcome-meta-label {
  flex: 0 0 4em;
  white-space: nowrap;
}
.welcome-link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--markly-primary, #0969da);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.welcome-link:hover { text-decoration: underline; }
.welcome-email {
  color: var(--markly-text, #1f2328);
  user-select: text;
}
.edit-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--markly-background, #fff);
}
.edit-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.edit-host :deep(.source-editor-mount),
.edit-host :deep(.cm-editor) {
  height: 100%;
  width: 100%;
  max-width: 100%;
}
.edit-host :deep(.cm-scroller) {
  max-width: 100%;
  overflow: auto;
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
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  box-sizing: border-box;
  white-space: pre;
  tab-size: 2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  line-height: 1.55;
  color: var(--markly-text, #24292e);
  background: var(--markly-background, #fff);
}
.markly-app.word-wrap .source-view {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow-x: hidden;
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