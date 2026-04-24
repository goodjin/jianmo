<template>
  <div class="md-editor-app" :class="appClasses">
    <Toolbar
      v-if="editorReady"
      :mode="currentMode"
      :show-outline="showOutline"
      :show-line-numbers="editor.showLineNumbers"
      :find-panel-open="findReplaceVisible"
      :zoom-percent="zoomPercent"
      :rich-table-active="richTableInTable"
      @format="handleFormat"
      @insert="handleInsert"
      @switch-mode="switchMode"
      @undo="handleUndo"
      @redo="handleRedo"
      @find-replace="onToolbarFindReplace"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @zoom-reset="zoomReset"
      @zoom-set="zoomSet"
      @toggle-outline="showOutline = !showOutline"
      @toggle-line-numbers="handleToggleLineNumbers"
      @export="handleExport"
      @rich-table-op="handleRichTableOp"
      @rich-table-help="richTableHelpOpen = true"
    />
    <!-- 字数统计 -->
    <div class="word-count" v-if="editorReady">
      <span>字数: {{ wordCount }}</span>
      <span>字符: {{ charCount }}</span>
      <span>行数: {{ lineCount }}</span>
    </div>

    <!-- 查找替换面板 -->
    <div
      v-if="richTableHelpOpen"
      class="markly-table-help-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="markly-table-help-title"
      @click.self="richTableHelpOpen = false"
    >
      <div class="markly-table-help-panel">
        <h3 id="markly-table-help-title">Rich 表格快捷键</h3>
        <p class="markly-table-help-hint">在表格单元格内生效；按钮在光标进入表格后可用。</p>
        <ul class="markly-table-help-list">
          <li><kbd>Mod</kbd> 在 macOS 为 ⌘，在 Windows / Linux 为 Ctrl。</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>↑</kbd>：上方插入行</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>↓</kbd>：下方插入行</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>←</kbd>：左侧插入列</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>→</kbd>：右侧插入列</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>Backspace</kbd>：删除当前行</li>
          <li><kbd>Mod</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Backspace</kbd>：删除当前列</li>
          <li><kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>：在单元格间移动（由编辑器表格键位处理）</li>
        </ul>
        <button type="button" class="markly-table-help-close" @click="richTableHelpOpen = false">关闭</button>
      </div>
    </div>

    <FindReplacePanel
      :visible="findReplaceVisible"
      :match-count="findMatches.length"
      :match-count-truncated="findMatchesTruncated"
      :current-match-index="findActiveIdx"
      @close="onFindPanelClose"
      @query-change="onFindQueryChange"
      @find-next="handleFindNext"
      @find-prev="handleFindPrev"
      @replace="handleFindReplaceOnce"
      @replace-all="handleReplaceAllFromPanel"
    />

    <!-- Rich 降级提示条：只在非 rich 且最近一次 Rich 启动失败/超时时显示 -->
    <div
      v-if="editorReady && currentMode !== 'rich' && richFallbackBannerVisible"
      class="rich-fallback-banner"
      role="status"
      aria-live="polite"
      data-testid="rich-fallback-banner"
    >
      <span class="msg">
        Rich 启动{{ richFallbackBannerReason === 'timeout' ? '超时' : '失败' }}，已切换到 Source。
      </span>
      <button type="button" class="retry-btn" @click="retryRichFromFallback">重试 Rich</button>
      <button type="button" class="retry-btn" data-testid="copy-diagnostics-btn" @click="copyDiagnosticsToClipboard">
        复制诊断信息
      </button>
    </div>

    <!-- 大文档分级提示 + 可选手动恢复（M8） -->
    <div
      v-if="editorReady && perfDegradeBannerVisible"
      class="rich-fallback-banner"
      role="status"
      aria-live="polite"
      data-testid="perf-degrade-banner"
    >
      <span class="msg">{{ perfDegradeReason }}</span>
      <button
        v-if="!richPerfDegradeUserFull"
        type="button"
        class="retry-btn"
        data-testid="perf-degrade-cta-full"
        @click="requestFullRichRender"
      >
        仍要完整渲染
      </button>
      <button
        v-else
        type="button"
        class="retry-btn"
        data-testid="perf-degrade-cta-restore"
        @click="restoreAutoRichRender"
      >
        恢复自动
      </button>
    </div>

    <!-- Toast -->
    <div v-if="toastOpen" class="markly-toast" role="status" aria-live="polite">
      {{ toastMessage }}
    </div>

    <!-- Rich 表格右键菜单 -->
    <div
      v-if="richTableMenuOpen"
      class="markly-context-menu"
      role="menu"
      aria-label="Rich Table Menu"
      data-testid="rich-table-context-menu"
      :style="{ left: `${richTableMenuX}px`, top: `${richTableMenuY}px` }"
      @contextmenu.prevent
    >
      <button
        v-for="item in RICH_TABLE_MENU_ITEMS"
        :key="item.op"
        type="button"
        role="menuitem"
        class="markly-context-menu-item"
        :data-testid="`rich-table-op-${item.op}`"
        @mousedown.prevent
        @click="onRichTableContextMenuOp(item.op)"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- 图片预览弹窗 -->
    <ImagePreview
      :visible="imagePreviewVisible"
      :src="currentImageSrc"
      :images="currentImages"
      :index="currentImageIndex"
      @close="imagePreviewVisible = false"
    />

    <div class="editor-main">
      <div class="editor-container" :style="editorContainerStyle">
        <!-- 编辑器容器 (IR/source 由 CM6；rich 由 Milkdown/PM) -->
        <div
          ref="editorContainerRef"
          class="cm-editor-container"
          v-show="editorReady && currentMode !== 'rich'"
        ></div>

        <MilkdownEditor
          v-if="editorReady"
          v-show="currentMode === 'rich'"
          :content="content"
          :config="config!"
          :rich-perf-effective-tier="richPerfEffectiveTier"
          @change="onRichContentChange"
          @ready="onRichReady"
          @table-context="onRichTableContext"
          @table-context-menu="onRichTableContextMenu"
          ref="milkdownRef"
        />

        <div v-if="!editorReady" class="loading">
          <span>Loading editor...</span>
        </div>
      </div>

      <!-- 大纲视图 -->
      <OutlinePanel
        v-if="editorReady && showOutline"
        :content="content"
        :current-mode="currentMode"
        @jump="handleOutlineJump"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useEditor } from './composables/useEditor';
import Toolbar from './components/Toolbar.vue';
import OutlinePanel from './components/OutlinePanel.vue';
import FindReplacePanel from './components/FindReplacePanel.vue';
import ImagePreview from './components/ImagePreview.vue';
import MilkdownEditor from './components/MilkdownEditor.vue';
import type { RichTableOp } from './core/richTableCommands';
import { hasToc, updateTocInContent } from './utils/toc';
import { skipWindowUndoRedoWhenEditorFocused } from './utils/undoRedoKeys';
import { isMilkdownProseMirrorFocused } from './utils/editorFocus';
import { shouldAppHandleTabIndent } from './utils/richTabPolicy';
import { getRichPerfTier, type RichPerfTier } from './utils/richPerfTier';
import {
  patternToRegExp,
  findAllMatchesInText,
  findFirstMatchAfter,
  findLastMatchBefore,
  matchOrdinalInText,
  type FindPatternMode,
} from './utils/findPattern';
import type { ExtensionConfig, ExtensionMessage, EditorMode } from '../../src/types';
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';

import { useVSCode } from './composables/useVSCode';
const { postMessage, getState, setState } = useVSCode();

declare global {
  interface Window {
    __marklyE2E?: {
      getContent: () => string;
      setContent: (c: string) => void;
      getSelectionAnchor: () => number;
      setSelectionAnchor: (anchor: number, head?: number | null) => void;
      applyFormat: (format: string) => void;
      insertNode: (type: string) => void;
      undo: () => void;
      redo: () => void;
      switchMode: (mode: EditorMode) => void;
      getEditorMode: () => EditorMode;
      replaceAll: (
        findText: string,
        replaceText: string,
        options: {
          caseSensitive: boolean;
          useRegex: boolean;
          useGlob?: boolean;
          useWholeWord?: boolean;
        }
      ) => void;
      getUndoDepth: () => number;
      getRedoDepth: () => number;
      undoCmd: () => boolean;
      redoCmd: () => boolean;
      getZoom?: () => number;
      getDiagnostics?: () => unknown;
      /** E2E：Rich 渲染就绪（5s 门控）：Vue 文稿含 Section B + 子树文本含 + 存在对应 h1–h6 + ProseMirror/textbox + 序列化非空时须含 Section B */
      isRichDocumentPainted?: () => boolean;
      getRichPmSelection?: () => {
        from: number;
        to: number;
        parentType: string;
        depth: number;
        inTable: boolean;
        cellType: string | null;
      } | null;
      runRichTableOp?: (op: string) => boolean;
      simulateRichTablePaste?: (payload: { plain?: string; html?: string }) => boolean;
      setRichTableCellSelection?: (payload: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }) => boolean;
    };
  }
}

// State
const content = ref('');
const config = ref<ExtensionConfig | null>(null);
const editorReady = ref(false);
const currentMode = ref<EditorMode>('rich');
const editorContainerStyle = computed(() => ({
  overflowX: 'auto',
  overflowY: 'auto',
}));
const editorContainerRef = ref<HTMLElement | null>(null);
const milkdownRef = ref<any>(null);
const richReadySuccess = ref<boolean | null>(null);
let richStartupWatchdog: ReturnType<typeof setTimeout> | null = null;
let richStartupAttemptId = 0;
const richAutoFallbackOnce = ref(false);
const richFallbackBannerVisible = ref(false);
const richFallbackBannerReason = ref<'fail' | 'timeout' | null>(null);
const perfDegradeBannerVisible = ref(false);
const perfDegradeReason = ref<string>('');
const richPerfDegradeUserFull = ref(false);
const computedRichPerfTier = computed(() => getRichPerfTier(content.value ?? ''));
const richPerfEffectiveTier = computed((): RichPerfTier => {
  if (richPerfDegradeUserFull.value) return 0;
  return computedRichPerfTier.value;
});
const richTableInTable = ref(false);
const richTableHelpOpen = ref(false);
const richTableMenuOpen = ref(false);
const richTableMenuX = ref(0);
const richTableMenuY = ref(0);

const toastOpen = ref(false);
const toastMessage = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const RICH_TABLE_OPS = new Set<string>([
  'addRowAfter',
  'addRowBefore',
  'addColAfter',
  'addColBefore',
  'toggleHeaderRow',
  'mergeCells',
  'splitCell',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'deleteRow',
  'deleteCol',
]);

const RICH_TABLE_MENU_ITEMS: Array<{ op: RichTableOp; label: string }> = [
  { op: 'addRowBefore', label: '上方插入行' },
  { op: 'addRowAfter', label: '下方插入行' },
  { op: 'addColBefore', label: '左侧插入列' },
  { op: 'addColAfter', label: '右侧插入列' },
  { op: 'toggleHeaderRow', label: '切换表头行' },
  { op: 'alignLeft', label: '当前列左对齐' },
  { op: 'alignCenter', label: '当前列居中' },
  { op: 'alignRight', label: '当前列右对齐' },
  { op: 'mergeCells', label: '合并单元格' },
  { op: 'splitCell', label: '拆分单元格' },
  { op: 'deleteRow', label: '删除当前行' },
  { op: 'deleteCol', label: '删除当前列' },
];

// E2E/诊断：抓取最近的 console.error/warn，帮助定位 Webview 内部初始化失败
const consoleRing: Array<{ level: 'error' | 'warn'; text: string }> = [];
let consolePatched = false;
function patchConsoleOnce(): void {
  if (consolePatched) return;
  consolePatched = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      consoleRing.push({ level: 'error', text: args.map(String).join(' ') });
      if (consoleRing.length > 50) consoleRing.splice(0, consoleRing.length - 50);
    } catch {
      // ignore
    }
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    try {
      consoleRing.push({ level: 'warn', text: args.map(String).join(' ') });
      if (consoleRing.length > 50) consoleRing.splice(0, consoleRing.length - 50);
    } catch {
      // ignore
    }
    origWarn(...args);
  };
}

function installGlobalErrorGuards(): void {
  if (typeof window === 'undefined') return;
  const handle = (err: unknown) => {
    const msg = String((err as any)?.message ?? err ?? '');
    // ExTester 下偶发出现 Milkdown 初始化竞态：editorViewCtx 未注入时抛错，导致整个 webview 进入“红字 Error”页。
    // 这里兜底：吞掉该错误并强制切回 Source，保证 UI/E2E 不被整页崩溃打断。
    if (msg.includes('MilkdownError') && msg.includes('Context "editorView" not found')) {
      try {
        // 只在 rich 下处理；避免误伤其它错误
        if (currentMode.value === 'rich') currentMode.value = 'source';
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  };
  window.addEventListener(
    'error',
    (e) => {
      if (handle((e as ErrorEvent).error)) {
        e.preventDefault();
      }
    },
    true
  );
  window.addEventListener(
    'unhandledrejection',
    (e) => {
      if (handle((e as PromiseRejectionEvent).reason)) {
        e.preventDefault();
      }
    },
    true
  );
}

// 尽早安装：避免 webview 在初始化阶段因 Milkdown 未捕获异常直接进入“红字 Error”页
patchConsoleOnce();
installGlobalErrorGuards();

// Table formatting debounce
let tableFormatTimeout: ReturnType<typeof setTimeout> | null = null;
const TABLE_FORMAT_DELAY = 500; // ms

// Initialize useEditor hook
const editor = useEditor({
  initialContent: '',
  initialMode: currentMode.value,
  onChange: (newContent: string) => {
    content.value = newContent;
    sendMessage({
      type: 'CONTENT_CHANGE',
      payload: { content: newContent },
    });
  },
  onModeChange: (newMode: EditorMode) => {
    // rich 模式由外层 switchMode 管理（CM6 不认识 rich）
    if (currentMode.value !== 'rich') {
      currentMode.value = newMode;
    }
  }
});

function onRichContentChange(newContent: string): void {
  // MilkdownEditor 常驻后（v-show 隐藏），其 markdownUpdated 仍会触发；
  // 在非 rich 模式下应忽略回传，避免把 content.value 冲掉，导致 E2E 的基准文档丢失。
  if (currentMode.value !== 'rich') return;
  content.value = newContent;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: newContent },
  });
}

function onRichReady(_success: boolean): void {
  // Rich 编辑器自身 ready 由组件内部处理；这里不改变 editorReady（由 CM6 INIT 流程控制）
  richReadySuccess.value = _success;
  if (_success) {
    if (richStartupWatchdog) {
      clearTimeout(richStartupWatchdog);
      richStartupWatchdog = null;
    }
    return;
  }

  // Rich 初始化失败：自动降级到 Source，保证编辑不中断
  if (currentMode.value === 'rich' && !richAutoFallbackOnce.value) {
    richAutoFallbackOnce.value = true;
    richFallbackBannerVisible.value = true;
    richFallbackBannerReason.value = 'fail';
    showToast('Rich 编辑器启动失败，已自动切换到 Source 模式。');
    switchMode('source');
  }
}

function onToolbarFindReplace(): void {
  findReplaceVisible.value = true;
}

// UI state
const findReplaceVisible = ref(false);
const imagePreviewVisible = ref(false);
const currentImages = ref<string[]>([]);
const currentImageIndex = ref(0);
const currentImageSrc = ref('');
const showOutline = ref(false);

// Zoom (editor view)
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const zoom = ref<number>(1);
const zoomPercent = computed<number>(() => Math.round(zoom.value * 100));

function clampZoom(v: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(v) || 1));
}

function applyZoomToDom(): void {
  document.documentElement.style.setProperty('--markly-zoom', String(zoom.value));
}

function persistZoom(): void {
  const prev = getState();
  const base = prev && typeof prev === 'object' ? (prev as Record<string, unknown>) : {};
  setState({ ...base, marklyZoom: zoom.value });
}

const ZOOM_PERSIST_DEBOUNCE_MS = 300;
let zoomPersistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistZoom(): void {
  if (zoomPersistTimer) clearTimeout(zoomPersistTimer);
  zoomPersistTimer = setTimeout(() => {
    zoomPersistTimer = null;
    persistZoom();
  }, ZOOM_PERSIST_DEBOUNCE_MS);
}

function zoomIn(): void {
  zoom.value = clampZoom(Math.round((zoom.value + ZOOM_STEP) * 10) / 10);
}

function zoomOut(): void {
  zoom.value = clampZoom(Math.round((zoom.value - ZOOM_STEP) * 10) / 10);
}

function zoomReset(): void {
  zoom.value = 1;
}

function zoomSet(v: number): void {
  zoom.value = clampZoom(v);
}

const findState = reactive({
  findText: '',
  replaceText: '',
  caseSensitive: false,
  wholeWord: false,
  patternMode: 'literal' as FindPatternMode,
});
const findMatches = ref<{ from: number; to: number }[]>([]);
const findMatchesTruncated = ref(false);
const findActiveIdx = ref(-1);
/** 当前选区落在 UI 列表（截断前 N 条）之外时的匹配区间 */
const findOffListMatch = ref<{ from: number; to: number } | null>(null);

/** Rich 查找：模拟 CM6 的 head 位置（用于下一个/上一个），打开面板时归零 */
const richFindAnchor = ref(0);

/** 查找面板 UI 侧最多保留的匹配区间数，避免超大文档 GC 抖动（全部替换仍整篇处理） */
const FIND_UI_MAX_MATCHES = 5000;

// Find/Replace recompute 性能优化：对 query-change / content-change 做可取消的 debounce
const FIND_RECOMPUTE_DEBOUNCE_MS = 160; // 建议 120-200ms
let findRecomputeTimer: ReturnType<typeof setTimeout> | null = null;
let findRecomputeSeq = 0;
let pendingPreservedActiveIdx: number | null = null;

function cancelPendingFindRecompute(): void {
  if (findRecomputeTimer) {
    clearTimeout(findRecomputeTimer);
    findRecomputeTimer = null;
  }
  pendingPreservedActiveIdx = null;
  // seq 不回退；旧 timer 已被 clear 就不会执行
}

function scheduleFindRecompute(delayMs = FIND_RECOMPUTE_DEBOUNCE_MS): void {
  // 面板没开时不扫描；关闭/卸载会 cancel
  if (!findReplaceVisible.value) return;

  const findText = findState.findText?.trim() ?? '';
  if (!findText) return;

  const seq = ++findRecomputeSeq;
  if (findRecomputeTimer) clearTimeout(findRecomputeTimer);
  findRecomputeTimer = setTimeout(() => {
    if (seq !== findRecomputeSeq) return;
    findRecomputeTimer = null;
    const preserved = pendingPreservedActiveIdx;
    pendingPreservedActiveIdx = null;
    recomputeFindMatches(preserved);
    updateFindHighlightClass();
  }, delayMs);
}

// Word count
const wordCount = computed(() => {
  if (!content.value) return 0;
  // Count Chinese characters and English words
  const chineseChars = (content.value.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.value.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
});

const charCount = computed(() => {
  return content.value?.length || 0;
});

const lineCount = computed(() => {
  if (!content.value) return 0;
  return content.value.split('\n').length;
});

// Theme：系统深浅色单独 ref，避免 prefers-color-scheme 变化时整份 config 展开触发大范围更新
const systemPrefersDark = ref(
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
);
const isDark = computed(() => {
  if (!config.value) return false;
  if (config.value.editor.theme === 'auto') {
    return systemPrefersDark.value;
  }
  return config.value.editor.theme === 'dark';
});

const wrapPolicy = computed(() => config.value?.editor?.wrapPolicy ?? 'autoWrap');
const tableCellWrap = computed(() => config.value?.editor?.tableCellWrap ?? 'wrap');
const appClasses = computed(() => ({
  'theme-dark': isDark.value,
  'wrap-auto': wrapPolicy.value === 'autoWrap',
  'wrap-scroll': wrapPolicy.value === 'preferScroll',
  'table-cell-wrap': tableCellWrap.value === 'wrap',
  'table-cell-nowrap': tableCellWrap.value === 'nowrap',
}));

/** 确保 CM6 已挂载到容器并完成 INIT（避免宿主过早 postMessage INIT 时 ref 未就绪 → 永久 Loading） */
function ensureEditorFromInit(): boolean {
  const el = editorContainerRef.value;
  if (!el) return false;
  if (!editor.view.value) {
    editor.createEditor(el);
    el.addEventListener('click', handleGlobalClick);
    el.addEventListener('contextmenu', handleGlobalContextMenu);
  }
  editor.setContent(content.value);
  editorReady.value = true;
  console.log('[Webview] editorReady set to true');
  applyZoomToDom();

  // e2e 调试桥：让真 UI 测试能稳定读取/驱动编辑器状态（不依赖 DOM 可见文本/落盘时序）
  patchConsoleOnce();
  installGlobalErrorGuards();
  window.__marklyE2E = {
    getContent: () => {
      if (currentMode.value === 'rich') {
        const c = content.value ?? '';
        // Rich 初始化早期 milkdownRef 可能尚未 ready；以单一真源 content 兜底，保证 E2E 与消息回路稳定
        return milkdownRef.value?.getContent?.() || c || '';
      }
      return editor.getContent();
    },
    setContent: (c: string) => {
      content.value = c;
      editor.setContent(c);
      if (currentMode.value === 'rich') {
        milkdownRef.value?.setContent?.(c);
      }
    },
    getSelectionAnchor: () => editor.view.value?.state.selection.main.anchor ?? -1,
    setSelectionAnchor: (anchor: number, head?: number | null) => {
      const v = editor.view.value;
      if (!v) return;
      const len = v.state.doc.length;
      const a = Math.min(Math.max(0, anchor), len);
      // WebDriver 常把「省略参数」序列化成 null；须与 undefined 一样视为折叠光标
      const h = head == null ? a : Math.min(Math.max(0, head), len);
      v.dispatch({ selection: { anchor: a, head: h } });
    },
    applyFormat: (format: string) => handleFormat(format),
    insertNode: (type: string) => handleInsert(type),
    undo: () => handleUndo(),
    redo: () => handleRedo(),
    switchMode: (mode: EditorMode) => switchMode(mode),
    /** 对外语义以 UI 模式为准（rich/ir/source） */
    getEditorMode: (): EditorMode => currentMode.value,
    replaceAll: (findText, replaceText, options) =>
      handleReplaceAll(findText, replaceText, {
        caseSensitive: options.caseSensitive,
        patternMode: options.useRegex ? 'regex' : options.useGlob ? 'glob' : 'literal',
        wholeWord: options.useWholeWord ?? false,
      }),
    getUndoDepth: () => (editor.view.value ? undoDepth(editor.view.value.state) : 0),
    getRedoDepth: () => (editor.view.value ? redoDepth(editor.view.value.state) : 0),
    undoCmd: () => {
      const v = editor.view.value;
      return v ? undo({ state: v.state, dispatch: v.dispatch }) : false;
    },
    redoCmd: () => {
      const v = editor.view.value;
      return v ? redo({ state: v.state, dispatch: v.dispatch }) : false;
    },
    getZoom: () => zoom.value,
    getDiagnostics: () => {
      const root = document.querySelector('.milkdown-editor') as HTMLElement | null;
      const headings = root ? root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]') : null;
      const editable =
        root?.querySelector('[role="textbox"]') ||
        root?.querySelector('.ProseMirror') ||
        root?.querySelector('[contenteditable="true"]');
      return {
        mode: currentMode.value,
        richReadySuccess: richReadySuccess.value,
        contentHasSectionB: (content.value || '').includes('Section B'),
        milkdownRootExists: !!root,
        milkdownTextHasSectionB: (root?.textContent || '').includes('Section B'),
        headingCount: headings ? headings.length : 0,
        headingTextSample: headings && headings.length > 0 ? (headings[0].textContent || '').slice(0, 80) : '',
        editableExists: !!editable,
        consoleRecent: consoleRing.slice(-10),
      };
    },
    isRichDocumentPainted: (): boolean => {
      if (currentMode.value !== 'rich') return true;
      const c = content.value || '';
      if (!c.includes('Section B')) return false;
      const root = document.querySelector('.milkdown-editor');
      if (!root) return false;
      const text = root.textContent || '';
      if (!text.includes('Section B')) return false;
      // 不以 milkdownRef.getContent() 为准：Rich 下 E2E 的 getContent 先读 content.value，而序列化器可能晚一帧仍反映旧 doc，会误杀门控
      const hasSectionHeading = Array.from(
        root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')
      ).some((el) => (el.textContent || '').includes('Section B'));
      if (!hasSectionHeading) return false;
      const editable =
        root.querySelector('[role="textbox"]') ||
        root.querySelector('.ProseMirror') ||
        root.querySelector('[contenteditable="true"]');
      if (!editable) return false;
      return true;
    },
    getRichPmSelection: () => {
      if (currentMode.value !== 'rich') return null;
      return (milkdownRef.value as any)?.getPmSelectionDiagnostics?.() ?? null;
    },
    runRichTableOp: (op: string) => {
      if (currentMode.value !== 'rich') return false;
      if (!RICH_TABLE_OPS.has(op)) return false;
      return Boolean((milkdownRef.value as any)?.runRichTableOp?.(op));
    },
    runRichFormat: (format: string) => {
      if (currentMode.value !== 'rich') return false;
      try {
        (milkdownRef.value as any)?.applyFormat?.(format);
        return true;
      } catch {
        return false;
      }
    },
    simulateRichTablePaste: (payload: { plain?: string; html?: string }) => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.simulateRichTablePaste?.(payload));
    },
    setRichTableCellSelection: (payload: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }) => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.setRichTableCellSelection?.(payload));
    },
    e2eSelectFirstTableBodyCell: () => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2eSelectFirstTableBodyCell?.());
    },
    e2eSetCellSelectionInFirstTable: (payload: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }) => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2eSetCellSelectionInFirstTable?.(payload));
    },
    e2eSelectListItemText: (payload: { index: number }) => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2eSelectListItemText?.(payload));
    },
    e2ePressTab: (payload?: { shift?: boolean }) => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2ePressTab?.(payload));
    },
    e2eIndentListItem: () => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2eIndentListItem?.());
    },
    e2eOutdentListItem: () => {
      if (currentMode.value !== 'rich') return false;
      return Boolean((milkdownRef.value as any)?.e2eOutdentListItem?.());
    },
  };

  return true;
}

function scheduleEnsureEditorFromInit() {
  if (ensureEditorFromInit()) return;
  nextTick(() => {
    if (ensureEditorFromInit()) return;
    requestAnimationFrame(() => {
      ensureEditorFromInit();
    });
  });
}

// Message handling
function handleMessage(event: MessageEvent) {
  const message: ExtensionMessage = event.data;
  console.log('[Webview] Received message:', message.type, message);

  switch (message.type) {
    case 'INIT':
      console.log('[Webview] INIT received, content length:', message.payload.content?.length);
      content.value = message.payload.content;
      config.value = message.payload.config;
      scheduleEnsureEditorFromInit();
      break;

    case 'CONTENT_UPDATE':
      // 只有内容真正变化时才更新，避免重置光标位置
      if (message.payload.content !== content.value) {
        content.value = message.payload.content;
        editor.setContent(message.payload.content);
      }
      break;

    case 'CONFIG_CHANGE':
      // 防御性编程：确保 config.value 不为 null
      if (config.value) {
        config.value = { ...config.value, ...message.payload.config } as ExtensionConfig;
      } else {
        config.value = message.payload.config as ExtensionConfig;
      }
      break;

    case 'SWITCH_MODE': {
      const m = message.payload.mode;
      // preview 历史命名：在富文本路线下默认映射到 rich
      switchMode(m === 'preview' ? 'rich' : m);
      break;
    }
      
    case 'SAVE':
      // VS Code 触发的保存，也需要更新 TOC
      saveWithTocUpdate();
      break;

    default:
      // Unknown message type - ignore silently
      break;
  }
}

function sendMessage(message: any) {
  postMessage(message);
}

// 编辑器准备好后的回调
function handleEditorReady(success: boolean) {
  if (!success) {
    console.error('Editor initialization failed');
    // 可以在这里显示错误提示或重试逻辑
  }
}

// Mode switching
function switchMode(mode: EditorMode) {
  if (mode === 'rich') {
    currentMode.value = 'rich';
    // 退出 CM6 视图焦点态，避免快捷键冲突；内容以 content 为准
    cancelPendingFindRecompute();
    findReplaceVisible.value = false;
    // MilkdownEditor 常驻时不会因为 v-if 重建；切回 rich 时需显式同步一次内容，避免显示旧 doc
    try {
      milkdownRef.value?.setContent?.(content.value ?? '');
    } catch (e) {
      console.warn('[Rich] sync content on enter failed:', e);
      if (!richAutoFallbackOnce.value) {
        richAutoFallbackOnce.value = true;
        richFallbackBannerVisible.value = true;
        richFallbackBannerReason.value = 'fail';
        showToast('Rich 编辑器启动失败，已自动切换到 Source 模式。');
        switchMode('source');
      }
      return;
    }

    // 启动 watchdog：如果 Rich 一直没 ready（或 ready=false），也要降级
    richReadySuccess.value = null;
    richStartupAttemptId += 1;
    const attempt = richStartupAttemptId;
    if (richStartupWatchdog) clearTimeout(richStartupWatchdog);
    richStartupWatchdog = setTimeout(() => {
      if (attempt !== richStartupAttemptId) return;
      if (currentMode.value !== 'rich') return;
      if (richReadySuccess.value === true) return;
      if (richAutoFallbackOnce.value) return;
      richAutoFallbackOnce.value = true;
      richFallbackBannerVisible.value = true;
      richFallbackBannerReason.value = 'timeout';
      showToast('Rich 编辑器启动超时，已自动切换到 Source 模式。');
      switchMode('source');
    }, 2500);
    return;
  }

  // 必须以 CM6 内实际 mode 为准；仅用 currentMode 会与 onModeChange 失步，导致「源码切不回 IR」时点 IR 被短路
  // 但当从 rich 切回 CM6 时，editor.mode 可能已经是目标值（历史残留），此时仍需更新 currentMode 并显示 CM6。
  if (mode === editor.mode.value && currentMode.value === mode) return;
  // 切模式会重建 EditorView；必须取消 find 的延迟任务，避免扫描旧 view/doc
  cancelPendingFindRecompute();

  // 保存当前滚动位置
  const scroller = document.querySelector('.cm-scroller') as HTMLElement;
  let scrollRatio = 0;

  if (scroller) {
    scrollRatio = scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
  }

  // 切换到 IR 或 Source 模式
  const currentEditorContent = editor.getContent();
  if (currentEditorContent !== content.value) {
    editor.setContent(content.value);
  }
  // 通过 composable 切换 CM6 state（否则只是 UI 状态变化，编辑器本身不会换模式）
  editor.switchMode(mode);
  currentMode.value = mode;

  // 恢复滚动位置
  setTimeout(() => {
    const newScroller = document.querySelector('.cm-scroller') as HTMLElement;
    if (newScroller && newScroller.scrollHeight > 0) {
      newScroller.scrollTop = scrollRatio * newScroller.scrollHeight;
    }
    editor.view.value?.focus();
  }, 50);
}

function retryRichFromFallback(): void {
  // 允许再次尝试；但降级 toast 仍会通过 richAutoFallbackOnce 防止刷屏
  richAutoFallbackOnce.value = false;
  richFallbackBannerVisible.value = false;
  richFallbackBannerReason.value = null;
  switchMode('rich');
}

// Event handlers
function handleChange(newContent: string) {
  content.value = newContent;
  sendMessage({
    type: 'CONTENT_CHANGE',
    payload: { content: newContent },
  });
}

// 保存文件时处理
function saveWithTocUpdate() {
  let updatedContent = editor.getContent();

  // 检查并更新 TOC
  if (hasToc(updatedContent)) {
    updatedContent = updateTocInContent(updatedContent);
    // 同步回编辑器
    if (updatedContent !== editor.getContent()) {
      editor.setContent(updatedContent);
      content.value = updatedContent;
    }
  }

  // 发送保存消息
  sendMessage({
    type: 'SAVE',
    payload: { content: updatedContent },
  });
}

function focusEditor() {
  // 使用 setTimeout 延迟 focus，避免与刚执行的 dispatch 冲突
  setTimeout(() => {
    try {
      editor.view.value?.focus();
    } catch (e) {
      console.warn('[Editor] focus failed:', e);
    }
  }, 0);
}

function handleFormat(format: string) {
  try {
    if (currentMode.value === 'rich') {
      milkdownRef.value?.applyFormat?.(format);
      return;
    }
    editor.applyFormat(format);
    focusEditor();
  } catch (err) {
    console.warn('[Editor] applyFormat failed:', err);
  }
}

function handleInsert(type: string) {
  try {
    if (currentMode.value === 'rich') {
      milkdownRef.value?.insertNode?.(type);
      return;
    }
    editor.insertNode(type);
    focusEditor();
  } catch (err) {
    console.warn('[Editor] insertNode failed:', err);
  }
}

function onRichTableContext(payload: { inTable: boolean }) {
  richTableInTable.value = payload.inTable;
}

function handleRichTableOp(op: string) {
  if (currentMode.value !== 'rich') return;
  if (!RICH_TABLE_OPS.has(op)) return;
  milkdownRef.value?.runRichTableOp?.(op as RichTableOp);
}

function onRichTableContextMenu(payload: { x: number; y: number }) {
  if (currentMode.value !== 'rich') return;
  richTableMenuX.value = payload.x;
  richTableMenuY.value = payload.y;
  richTableMenuOpen.value = true;
}

function closeRichTableContextMenu() {
  richTableMenuOpen.value = false;
}

function onRichTableContextMenuOp(op: RichTableOp) {
  closeRichTableContextMenu();
  handleRichTableOp(op);
}

function handleToggleLineNumbers() {
  editor.toggleLineNumbers();
}

function recomputeFindMatches(preservedActiveIdx: number | null = null): void {
  const v = editor.view.value;
  const text = currentMode.value === 'rich' ? (content.value ?? '') : v?.state.doc.toString() ?? '';
  const re = patternToRegExp(findState.findText, {
    caseSensitive: findState.caseSensitive,
    patternMode: findState.patternMode,
    wholeWord: findState.wholeWord,
  });
  if (!re || !findState.findText || !findState.findText.trim()) {
    findMatches.value = [];
    findMatchesTruncated.value = false;
    findActiveIdx.value = -1;
    findOffListMatch.value = null;
    return;
  }
  const { matches, truncated } = findAllMatchesInText(text, re, FIND_UI_MAX_MATCHES);
  findMatches.value = matches;
  findMatchesTruncated.value = truncated;
  findOffListMatch.value = null;
  if (findMatches.value.length === 0) {
    findActiveIdx.value = -1;
  } else if (preservedActiveIdx != null) {
    findActiveIdx.value = Math.min(Math.max(0, preservedActiveIdx), findMatches.value.length - 1);
  } else if (findActiveIdx.value >= findMatches.value.length) {
    // 默认语义：activeIdx 只做 clamp，不强制跳到 0
    findActiveIdx.value = findMatches.value.length - 1;
  }
}

function onFindQueryChange(payload: {
  findText: string;
  replaceText: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  patternMode: FindPatternMode;
}): void {
  Object.assign(findState, payload);
  const findText = findState.findText?.trim() ?? '';
  if (!findText) {
    cancelPendingFindRecompute();
    recomputeFindMatches();
    updateFindHighlightClass();
    return;
  }
  // 语义保持：query-change 前的 activeIdx 需要尽量保留（再 clamp）
  pendingPreservedActiveIdx = findActiveIdx.value;
  scheduleFindRecompute();
}

function findMatchIndexInArray(m: { from: number; to: number }): number {
  return findMatches.value.findIndex((x) => x.from === m.from && x.to === m.to);
}

function dispatchFindSelection(m: { from: number; to: number }): void {
  const v = editor.view.value;
  if (!v) return;
  v.dispatch({
    selection: { anchor: m.from, head: m.to },
    scrollIntoView: true,
  });
}

function activateFindMatch(m: { from: number; to: number }): void {
  const idx = findMatchIndexInArray(m);
  if (idx >= 0) {
    findActiveIdx.value = idx;
    findOffListMatch.value = null;
  } else {
    findActiveIdx.value = -1;
    findOffListMatch.value = m;
  }
  if (currentMode.value === 'rich') {
    const md = content.value ?? '';
    const needle = md.slice(m.from, m.to);
    const re = patternToRegExp(findState.findText, {
      caseSensitive: findState.caseSensitive,
      patternMode: findState.patternMode,
      wholeWord: findState.wholeWord,
    });
    if (re && needle) {
      const ord = matchOrdinalInText(md, re, m);
      milkdownRef.value?.selectPlainTextOccurrence?.(needle, ord);
    }
    richFindAnchor.value = m.to;
  } else {
    dispatchFindSelection(m);
  }
}

function updateFindHighlightClass(): void {
  const active = !!(
    findReplaceVisible.value &&
    findState.findText &&
    findState.findText.trim().length > 0 &&
    findMatches.value.length > 0
  );
  const cmRoot = editor.view.value?.dom;
  if (cmRoot) {
    cmRoot.classList.toggle('markly-find-highlight', active && currentMode.value !== 'rich');
  }
  const pmRoot =
    (document.querySelector('.milkdown-editor .ProseMirror') as HTMLElement | null) ??
    (document.querySelector('.milkdown-editor') as HTMLElement | null);
  if (pmRoot) {
    pmRoot.classList.toggle('markly-find-highlight', active && currentMode.value === 'rich');
  }
}

function handleFindNext(): void {
  if (!findState.findText.trim()) return;
  cancelPendingFindRecompute();
  recomputeFindMatches();
  if (!findMatches.value.length) return;

  if (currentMode.value === 'rich') {
    const pos = richFindAnchor.value;
    let idx = findMatches.value.findIndex((m) => m.from > pos);
    if (idx !== -1) {
      activateFindMatch(findMatches.value[idx]!);
    } else if (findMatchesTruncated.value) {
      const text = content.value ?? '';
      const re = patternToRegExp(findState.findText, {
        caseSensitive: findState.caseSensitive,
        patternMode: findState.patternMode,
        wholeWord: findState.wholeWord,
      });
      if (!re) return;
      const nav = findFirstMatchAfter(text, re, pos, true);
      if (!nav) return;
      activateFindMatch(nav);
    } else {
      activateFindMatch(findMatches.value[0]!);
    }
    updateFindHighlightClass();
    return;
  }

  const v = editor.view.value;
  if (!v) return;
  const pos = v.state.selection.main.head;
  let idx = findMatches.value.findIndex((m) => m.from > pos);
  if (idx !== -1) {
    activateFindMatch(findMatches.value[idx]!);
  } else if (findMatchesTruncated.value) {
    const text = v.state.doc.toString();
    const re = patternToRegExp(findState.findText, {
      caseSensitive: findState.caseSensitive,
      patternMode: findState.patternMode,
      wholeWord: findState.wholeWord,
    });
    if (!re) return;
    const nav = findFirstMatchAfter(text, re, pos, true);
    if (!nav) return;
    activateFindMatch(nav);
  } else {
    activateFindMatch(findMatches.value[0]!);
  }
  updateFindHighlightClass();
}

function handleFindPrev(): void {
  if (!findState.findText.trim()) return;
  cancelPendingFindRecompute();
  recomputeFindMatches();
  if (!findMatches.value.length) return;

  if (currentMode.value === 'rich') {
    const pos = richFindAnchor.value;
    let idx = -1;
    for (let i = findMatches.value.length - 1; i >= 0; i--) {
      if (findMatches.value[i]!.to < pos) {
        idx = i;
        break;
      }
    }
    if (idx !== -1) {
      activateFindMatch(findMatches.value[idx]!);
    } else if (findMatchesTruncated.value) {
      const text = content.value ?? '';
      const re = patternToRegExp(findState.findText, {
        caseSensitive: findState.caseSensitive,
        patternMode: findState.patternMode,
        wholeWord: findState.wholeWord,
      });
      if (!re) return;
      const nav = findLastMatchBefore(text, re, pos, true);
      if (!nav) return;
      activateFindMatch(nav);
    } else {
      activateFindMatch(findMatches.value[findMatches.value.length - 1]!);
    }
    updateFindHighlightClass();
    return;
  }

  const v = editor.view.value;
  if (!v) return;
  const pos = v.state.selection.main.head;
  let idx = -1;
  for (let i = findMatches.value.length - 1; i >= 0; i--) {
    if (findMatches.value[i]!.to < pos) {
      idx = i;
      break;
    }
  }
  if (idx !== -1) {
    activateFindMatch(findMatches.value[idx]!);
  } else if (findMatchesTruncated.value) {
    const text = v.state.doc.toString();
    const re = patternToRegExp(findState.findText, {
      caseSensitive: findState.caseSensitive,
      patternMode: findState.patternMode,
      wholeWord: findState.wholeWord,
    });
    if (!re) return;
    const nav = findLastMatchBefore(text, re, pos, true);
    if (!nav) return;
    activateFindMatch(nav);
  } else {
    activateFindMatch(findMatches.value[findMatches.value.length - 1]!);
  }
  updateFindHighlightClass();
}

function handleFindReplaceOnce(): void {
  const m =
    findActiveIdx.value >= 0
      ? findMatches.value[findActiveIdx.value]
      : findOffListMatch.value;
  if (!m) return;
  const ins = findState.replaceText;

  if (currentMode.value === 'rich') {
    const text = content.value ?? '';
    const newText = text.slice(0, m.from) + ins + text.slice(m.to);
    milkdownRef.value?.setContent?.(newText);
    content.value = newText;
    const afterPos = m.from + ins.length;
    cancelPendingFindRecompute();
    recomputeFindMatches();
    if (findMatches.value.length === 0) {
      findActiveIdx.value = -1;
      findOffListMatch.value = null;
      richFindAnchor.value = afterPos;
      updateFindHighlightClass();
      return;
    }
    let idx = findMatches.value.findIndex((x) => x.from >= afterPos);
    if (idx === -1) idx = 0;
    activateFindMatch(findMatches.value[idx]!);
    updateFindHighlightClass();
    return;
  }

  const v = editor.view.value;
  if (!v) return;
  v.dispatch({
    changes: { from: m.from, to: m.to, insert: ins },
  });
  const afterPos = m.from + ins.length;
  cancelPendingFindRecompute();
  recomputeFindMatches();
  if (findMatches.value.length === 0) {
    findActiveIdx.value = -1;
    findOffListMatch.value = null;
    return;
  }
  let idx = findMatches.value.findIndex((x) => x.from >= afterPos);
  if (idx === -1) idx = 0;
  activateFindMatch(findMatches.value[idx]!);
  updateFindHighlightClass();
}

function handleReplaceAllFromPanel(): void {
  handleReplaceAll(findState.findText, findState.replaceText, {
    caseSensitive: findState.caseSensitive,
    patternMode: findState.patternMode,
    wholeWord: findState.wholeWord,
  });
}

function handleReplaceAll(
  findText: string,
  replaceText: string,
  opts: { caseSensitive: boolean; patternMode: FindPatternMode; wholeWord?: boolean }
): void {
  const v = editor.view.value;
  if (!findText) return;
  cancelPendingFindRecompute();
  const text = currentMode.value === 'rich' ? (content.value ?? '') : v?.state.doc.toString() ?? '';
  const re = patternToRegExp(findText, {
    caseSensitive: opts.caseSensitive,
    patternMode: opts.patternMode,
    wholeWord: opts.wholeWord,
  });
  if (!re) return;
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let newText: string;
  try {
    newText = text.replace(r, replaceText);
  } catch {
    return;
  }
  if (newText === text) return;
  if (currentMode.value === 'rich') {
    // Rich 侧：直接替换 markdown 字符串，再喂回解析器
    milkdownRef.value?.setContent?.(newText);
    content.value = newText;
  } else {
    if (!v) return;
    v.dispatch({
      changes: { from: 0, to: text.length, insert: newText },
    });
  }
  findMatches.value = [];
  findMatchesTruncated.value = false;
  findActiveIdx.value = -1;
  findOffListMatch.value = null;
}

function onFindPanelClose(): void {
  findReplaceVisible.value = false;
  cancelPendingFindRecompute();
  updateFindHighlightClass();
}

watch(content, () => {
  if (findReplaceVisible.value) {
    // content 变化只调度一次 debounce 的全量扫描，避免每次输入都 doc.toString() + regex 全量遍历
    scheduleFindRecompute();
  }
  // M7-3：大文档自动降级（重渲染按需关闭）
  recomputePerfDegradeUi();
});

watch(richPerfDegradeUserFull, () => recomputePerfDegradeUi());

watch(zoom, () => {
  applyZoomToDom();
  schedulePersistZoom();
});

watch(findReplaceVisible, () => {
  if (findReplaceVisible.value) {
    richFindAnchor.value = 0;
    // 刚打开时给一次快速计算（但仍可取消），保证 matchCount/activeIdx 及时可见
    pendingPreservedActiveIdx = findActiveIdx.value;
    scheduleFindRecompute(0);
  } else {
    cancelPendingFindRecompute();
  }
  updateFindHighlightClass();
});

watch(currentMode, () => {
  updateFindHighlightClass();
  if (currentMode.value !== 'rich') {
    richTableInTable.value = false;
    richTableHelpOpen.value = false;
    closeRichTableContextMenu();
  }
});

function handleUndo() {
  try {
    if (currentMode.value === 'rich') {
      milkdownRef.value?.undo?.();
      return;
    }
    editor.undo();
  } catch (e) {
    console.warn('[Editor] undo failed:', e);
  }
  focusEditor();
}

function handleRedo() {
  try {
    if (currentMode.value === 'rich') {
      milkdownRef.value?.redo?.();
      return;
    }
    editor.redo();
  } catch (e) {
    console.warn('[Editor] redo failed:', e);
  }
  focusEditor();
}

// 解析图片 URL（处理相对路径）
function resolveImageUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('file://')) {
    return src;
  }
  const baseUrl = document.baseURI || '';
  if (baseUrl) {
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return src;
    }
  }
  return src;
}

// Global click handler to intercept image clicks
function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'IMG') {
    const src = target.getAttribute('src') || '';
    const resolvedSrc = resolveImageUrl(src);

    const images = Array.from(document.querySelectorAll('.cm-editor-container img'))
      .map((img) => resolveImageUrl(img.getAttribute('src') || ''));
    const index = images.indexOf(resolvedSrc);

    currentImageSrc.value = resolvedSrc;
    currentImages.value = images;
    currentImageIndex.value = index;
    imagePreviewVisible.value = true;
  }
}

function handleWindowPointerDownCapture(e: PointerEvent) {
  if (!richTableMenuOpen.value) return;
  const t = e.target as HTMLElement | null;
  if (t && t.closest?.('[data-testid="rich-table-context-menu"]')) return;
  closeRichTableContextMenu();
}

function showToast(msg: string, durationMs = 2400) {
  toastMessage.value = msg;
  toastOpen.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastOpen.value = false;
    toastTimer = null;
  }, durationMs);
}

function buildDiagnosticsPayload() {
  try {
    const base = (window.__marklyE2E as any)?.getDiagnostics?.() ?? {};
    return {
      ts: new Date().toISOString(),
      ...base,
    };
  } catch {
    return { ts: new Date().toISOString(), mode: currentMode.value, richReadySuccess: richReadySuccess.value };
  }
}

async function copyDiagnosticsToClipboard() {
  const payload = buildDiagnosticsPayload();
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast('诊断信息已复制到剪贴板。');
    return;
  } catch {
    // ignore → fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'true');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) showToast('诊断信息已复制到剪贴板。');
    else showToast('复制失败：浏览器不支持剪贴板写入。');
  } catch {
    showToast('复制失败：浏览器不支持剪贴板写入。');
  }
}

function recomputePerfDegradeUi(): void {
  const comp = computedRichPerfTier.value;
  if (comp === 0) {
    richPerfDegradeUserFull.value = false;
  }
  if (comp === 0) {
    perfDegradeBannerVisible.value = false;
    perfDegradeReason.value = '';
    return;
  }
  perfDegradeBannerVisible.value = true;
  if (richPerfDegradeUserFull.value) {
    perfDegradeReason.value = '已手动开启完整渲染，若卡顿可点「恢复自动」。';
  } else {
    perfDegradeReason.value =
      comp === 1
        ? '中等规模文档：已降低 Mermaid/语法高亮强度以保证流畅。'
        : '检测到大文档，已自动关闭 Mermaid/语法高亮。';
  }
}

function requestFullRichRender() {
  richPerfDegradeUserFull.value = true;
  recomputePerfDegradeUi();
  showToast('已尽量开启完整渲染，若变卡可恢复自动。');
}

function restoreAutoRichRender() {
  richPerfDegradeUserFull.value = false;
  recomputePerfDegradeUi();
  showToast('已恢复按文档规模自动调整。');
}

function handleToastEvent(e: Event) {
  const ce = e as CustomEvent;
  const detail = (ce?.detail ?? {}) as { message?: string };
  const msg = typeof detail.message === 'string' ? detail.message : '';
  if (msg) showToast(msg);
}

// Global context menu handler for images
function handleGlobalContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'IMG') {
    e.preventDefault();
    const src = target.getAttribute('src') || '';
    const resolvedSrc = resolveImageUrl(src);
    sendMessage({
      type: 'OPEN_IMAGE_EDITOR',
      payload: { src: resolvedSrc },
    });
  }
}

function handleOutlineJump(pos: number, headingId: string) {
  if (currentMode.value === 'rich') {
    // 与大纲点击同一帧内 ProseMirror 可能尚未稳定；延后一帧再滚动手风琴容器内的 scrollTop
    nextTick(() => {
      requestAnimationFrame(() => {
        milkdownRef.value?.scrollToHeading?.(headingId);
      });
    });
    return;
  }

  if (editor.view.value) {
    const view = editor.view.value;

    // 先移动光标
    view.dispatch({
      selection: { anchor: pos },
    });

    // 然后滚动到该位置
    requestAnimationFrame(() => {
      const line = view.lineBlockAt(pos);
      if (line) {
        // 找到对应的 DOM 元素并滚动
        const scroller = view.scrollDOM;
        const coords = view.coordsAtPos(pos);
        if (coords && scroller) {
          scroller.scrollTop = coords.top - scroller.clientTop - 20;
        }
      }
    });

    focusEditor();
  }
}

// 导出处理函数
function handleExport(format: 'pdf' | 'html') {
  sendMessage({
    type: 'EXPORT',
    payload: { format },
  });
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

  // Cmd/Ctrl + S: 保存并更新 TOC
  if (ctrlKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveWithTocUpdate();
    return;
  }

  if (ctrlKey) {
    const milkdownFocused = currentMode.value === 'rich' && isMilkdownProseMirrorFocused();
    switch (e.key.toLowerCase()) {
      case 'b':
        if (milkdownFocused) return;
        e.preventDefault();
        handleFormat('bold');
        break;
      case 'i':
        if (milkdownFocused) return;
        e.preventDefault();
        handleFormat('italic');
        break;
      case 'k':
        if (milkdownFocused) return;
        e.preventDefault();
        if (e.shiftKey) {
          handleInsert('codeBlock');
        } else {
          handleInsert('link');
        }
        break;
      // Note: Ctrl+M removed to avoid potential conflicts
      // Math formula can be inserted via toolbar button
      case 'f':
        e.preventDefault();
        findReplaceVisible.value = true;
        break;
      case 'z':
        // CM6 minimalSetup 的 historyKeymap 已绑定 Mod-z，且 preventDefault 后仍会冒泡到 window。
        // 若此处再 handleUndo，会在一次按键内连续执行两次原生 undo，易与 history/focus 微任务交织出错。
        if (skipWindowUndoRedoWhenEditorFocused(editor.view.value?.hasFocus)) {
          return;
        }
        if (milkdownFocused) return;
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        break;
    }
  }

  // Tab 键缩进处理
  if (e.key === 'Tab') {
    if (!shouldAppHandleTabIndent({ mode: currentMode.value, key: e.key, target: e.target })) return;

    e.preventDefault();
    if (e.shiftKey) {
      handleFormat('outdent');
    } else {
      handleFormat('indent');
    }
  }

}

// Theme change listener - 仅更新系统深浅色 ref，避免克隆整份 ExtensionConfig
const themeChangeListener = () => {
  if (typeof window === 'undefined') return;
  systemPrefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// 初始化重试机制
let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_INIT_RETRIES = 5;
let initRetryCount = 0;

function checkInitStatus() {
  if (editorReady.value) {
    if (initRetryTimer) clearTimeout(initRetryTimer);
    return;
  }

  if (initRetryCount < MAX_INIT_RETRIES) {
    initRetryCount++;
    console.log(`[Webview] Retrying READY message (${initRetryCount}/${MAX_INIT_RETRIES})...`);
    sendMessage({ type: 'READY' });
    initRetryTimer = setTimeout(checkInitStatus, 1000);
  } else {
    console.error('[Webview] Failed to initialize after multiple retries.');
  }
}

// Lifecycle
onMounted(() => {
  // restore persisted zoom (per webview)
  try {
    const st = getState();
    const z =
      st && typeof st === 'object' && typeof (st as any).marklyZoom === 'number'
        ? (st as any).marklyZoom
        : 1;
    zoom.value = clampZoom(z);
    applyZoomToDom();
  } catch {
    // ignore
  }

  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('pointerdown', handleWindowPointerDownCapture, true);
  window.addEventListener('markly:toast' as any, handleToastEvent as any);

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeListener);

  // ref + 子组件在首帧后才稳定；与 INIT 时序对齐，避免同步阶段 ref 仍为空
  nextTick(() => {
    const el = editorContainerRef.value;
    if (el && !editor.view.value) {
      editor.createEditor(el);
      el.addEventListener('click', handleGlobalClick);
      el.addEventListener('contextmenu', handleGlobalContextMenu);
    }
    sendMessage({ type: 'READY' });
    initRetryTimer = setTimeout(checkInitStatus, 1000);
  });
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('pointerdown', handleWindowPointerDownCapture, true);
  window.removeEventListener('markly:toast' as any, handleToastEvent as any);
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeChangeListener);

  if (editorContainerRef.value) {
    editorContainerRef.value.removeEventListener('click', handleGlobalClick);
    editorContainerRef.value.removeEventListener('contextmenu', handleGlobalContextMenu);
  }

  // Destroy editor
  editor.destroy();
  cancelPendingFindRecompute();

  if (zoomPersistTimer) {
    clearTimeout(zoomPersistTimer);
    zoomPersistTimer = null;
  }
  persistZoom();

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  // Clear table format timeout
  if (tableFormatTimeout) {
    clearTimeout(tableFormatTimeout);
    tableFormatTimeout = null;
  }
});
</script>

<style scoped>
.md-editor-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  overflow: hidden;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  min-height: 0;
  /* 文档滚动容器：纵向滚动 + 横向滚动（长行/超宽内容不再被裁切） */
  overflow-y: auto;
  overflow-x: auto;
  display: flex;
  flex-direction: column;
  position: relative;
}

.cm-editor-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--vscode-editor-background);
}

/* Ensure CodeMirror takes full height */
:deep(.cm-editor) {
  height: 100%;
  width: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
  /* 与外框留白：上略大便于首行呼吸，左右略宽适合长行阅读 */
  padding: 20px 28px 24px;
}


.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vscode-descriptionForeground);
}

.theme-dark {
  /* Dark theme specific styles */
}

.markly-table-help-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.markly-context-menu {
  position: fixed;
  z-index: 20001;
  min-width: 180px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.35));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 6px;
}

.markly-context-menu-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.markly-context-menu-item:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.06));
}

.markly-context-menu-item:focus-visible {
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.markly-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 20050;
  max-width: min(720px, calc(100vw - 32px));
  background: var(--vscode-notifications-background, var(--vscode-editorWidget-background));
  color: var(--vscode-notifications-foreground, var(--vscode-foreground));
  border: 1px solid var(--vscode-notifications-border, rgba(128, 128, 128, 0.35));
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.rich-fallback-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  margin: 8px 12px 0;
  border-radius: 10px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.04));
  color: var(--vscode-foreground);
}

.rich-fallback-banner .msg {
  font-size: 12px;
  opacity: 0.9;
}

.rich-fallback-banner .retry-btn {
  border: 1px solid var(--vscode-button-border, transparent);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.rich-fallback-banner .retry-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

.markly-table-help-panel {
  max-width: 420px;
  width: 100%;
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-editorWidget-foreground);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 8px;
  padding: 16px 18px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.markly-table-help-panel h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.markly-table-help-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.markly-table-help-list {
  margin: 0 0 14px;
  padding-left: 1.2em;
  font-size: 12px;
  line-height: 1.55;
}

.markly-table-help-list kbd {
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--vscode-editorWidget-border);
  background: var(--vscode-editor-background);
}

.markly-table-help-close {
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid var(--vscode-button-border, transparent);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.word-count {
  display: flex;
  gap: 16px;
  padding: 6px 16px;
  background: var(--vscode-editorWidget-background);
  border-top: 1px solid var(--vscode-editorWidget-border);
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.word-count span {
  white-space: nowrap;
}
</style>
