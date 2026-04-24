<template>
  <div class="milkdown-editor" ref="editorRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  serializerCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { marklyTableGridPastePlugin, marklyTableStructureKeymapPlugin } from '../plugins/markly-table-rich';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { $prose } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';
import { CellSelection, isInTable, TableMap, selectedRect } from 'prosemirror-tables';
import { keymap } from 'prosemirror-keymap';
import { Fragment, Slice } from '@milkdown/prose/model';
import { footnote } from '../plugins/footnote';
import { callCommand } from '@milkdown/utils';
import { undoCommand, redoCommand } from '@milkdown/plugin-history';
import { toggleMark, wrapIn, setBlockType } from '@milkdown/prose/commands';
import { liftListItem, sinkListItem } from '@milkdown/prose/schema-list';
import { TextSelection } from '@milkdown/prose/state';
import type { ExtensionConfig } from '../../src/types';
import { runRichTableOp, type RichTableOp } from '../core/richTableCommands';
import type { RichPerfTier } from '../utils/richPerfTier';
import { setRuntimeRichPerfTier } from '../utils/richPerfRuntime';
import { decideTableGridSelectionFillMapping, parseTablePasteMatrix } from '../plugins/markly-table-rich';

// TOC 标记
const TOC_PLACEHOLDER = '<!-- TOC -->';
const TOC_REGEX = /<!--\s*TOC\s*-->/gi;

const props = withDefaults(
  defineProps<{
    content: string;
    config: ExtensionConfig;
    baseUrl?: string; // 用于解析相对图片路径
    /** M8：由 App 计算（含“仍要完整渲染”覆盖） */
    richPerfEffectiveTier?: RichPerfTier;
  }>(),
  { richPerfEffectiveTier: 0 as RichPerfTier }
);

// 防御性 computed：为 config 提供默认值（优化：避免每次创建新对象）
const defaultConfig = {
  editor: {
    fontFamily: 'SF Mono, Consolas, monospace',
    fontSize: 14,
    theme: 'light',
    lineNumbers: false,
    wordWrap: 'on',
    wrapPolicy: 'autoWrap',
    tableCellWrap: 'wrap',
    enableMermaid: true,
    enableShiki: false,
  }
};

const safeConfig = computed(() => {
  if (!props.config) return defaultConfig;
  // 合并默认值，避免创建新对象
  return {
    editor: {
      ...defaultConfig.editor,
      ...(props.config.editor || {}),
    },
  };
});

const emit = defineEmits<{
  (e: 'change', content: string): void;
  (e: 'image-click', src: string, images: string[], index: number): void;
  (e: 'image-context-menu', src: string, x: number, y: number): void;
  (e: 'toc-click', headingId: string): void;
  (e: 'ready', success: boolean): void;
  (e: 'table-context', payload: { inTable: boolean }): void;
  (e: 'table-context-menu', payload: { x: number; y: number }): void;
}>();

/** 随选区变化上报是否在表格内，供工具栏启用「表格结构」按钮 */
const tableContextMilkdownPlugin = $prose(() => {
  let lastInTable = false;
  return new Plugin({
    view(view) {
      const init = isInTable(view.state);
      lastInTable = init;
      queueMicrotask(() => emit('table-context', { inTable: init }));
      return {
        update(v) {
          const now = isInTable(v.state);
          if (now !== lastInTable) {
            lastInTable = now;
            emit('table-context', { inTable: now });
          }
        },
      };
    },
  });
});

const editorRef = ref<HTMLElement | null>(null);
let editor: Editor | null = null;
let isInternalChange = false;
let lastEmittedContent = '';
let pendingUpdate: { content: string; cursorPos: number } | null = null;
let updateTimeout: ReturnType<typeof setTimeout> | null = null;

let mermaidApi: (typeof import('mermaid')) | null = null;
let mermaidObserver: IntersectionObserver | null = null;
const mermaidRenderQueue: HTMLPreElement[] = [];
let mermaidQueuePump = false;
const mermaidSvgCache: Map<string, string> = new Map();
const MERMAID_SVG_CACHE_MAX = 120;
let mermaidRuntimeInitialized = false;

async function ensureMermaidLoaded(): Promise<(typeof import('mermaid')) | null> {
  if (mermaidApi) return mermaidApi;
  const enabled = (safeConfig.value as any)?.editor?.enableMermaid !== false;
  if (!enabled) return null;
  // M8 档 2：关闭 Mermaid
  if ((props.richPerfEffectiveTier ?? 0) >= 2) return null;
  try {
    const mod: any = await import('mermaid');
    mermaidApi = (mod?.default ?? mod) as any;
    return mermaidApi;
  } catch (e) {
    console.warn('[MilkdownEditor] mermaid lazy import failed (ignored):', e);
    return null;
  }
}

// 图片事件处理函数引用（用于清理）
let imageClickHandler: ((e: MouseEvent) => void) | null = null;
let imageContextMenuHandler: ((e: MouseEvent) => void) | null = null;
let tableContextMenuHandler: ((e: MouseEvent) => void) | null = null;

// 提取 Markdown 标题生成目录
interface TocItem {
  level: number;
  text: string;
  id: string;
}

function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // 生成标题 ID
      const id = generateHeadingId(text);
      headings.push({ level, text, id });
    }
  }
  
  return headings;
}

// 生成标题 ID
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '') // 移除特殊字符，保留中文
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并
    .replace(/^-|-$/g, ''); // 移除首尾连字符
}

// 生成 TOC Markdown
function generateTocMarkdown(headings: TocItem[]): string {
  if (headings.length === 0) {
    return '';
  }
  
  let toc = '\n## Table of Contents\n\n';
  
  for (const heading of headings) {
    const indent = '  '.repeat(heading.level - 1);
    toc += `${indent}- [${heading.text}](#${heading.id})\n`;
  }
  
  return toc;
}

// 为 Markdown 标题添加 ID（用于跳转）
function addIdsToHeadings(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const hashes = match[1];
      const text = match[2].trim();
      
      // 检查是否已有 ID 锚点
      if (/\{#[^}]+\}$/.test(text)) {
        // 已有 ID，保留
        result.push(line);
      } else {
        // 添加 ID
        const id = generateHeadingId(text);
        result.push(`${hashes} ${text} {#${id}}`);
      }
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/** 在已渲染 DOM 中定位标题（优先 id，否则按与大纲一致的 slug 规则匹配正文） */
function findHeadingElement(headingId: string): HTMLElement | null {
  if (!editorRef.value) return null;
  const esc =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(headingId)
      : headingId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const byId = editorRef.value.querySelector(`[id="${esc}"]`) as HTMLElement | null;
  if (byId) return byId;
  const hs = editorRef.value.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of hs) {
    const el = h as HTMLElement;
    if (el.id === headingId) return el;
    const raw = (el.textContent || '').trim().replace(/\{#[^}]+\}$/, '').trim();
    if (generateHeadingId(raw) === headingId) return el;
  }
  return null;
}

/** 将标题滚入 `.milkdown-editor` 可视区（该节点自身 overflow-y:auto，scrollIntoView 常去滚外层，E2E/面板布局下不可靠） */
function scrollHeadingIntoMilkdownRoot(heading: HTMLElement): void {
  const root = editorRef.value;
  if (!root) {
    heading.scrollIntoView({ behavior: 'auto', block: 'center' });
    return;
  }
  const rootRect = root.getBoundingClientRect();
  const hRect = heading.getBoundingClientRect();
  const rootCenterY = rootRect.top + rootRect.height / 2;
  const hCenterY = hRect.top + hRect.height / 2;
  root.scrollTop += hCenterY - rootCenterY;
}

/** 大纲 / TOC：滚动到标题并（若编辑器已就绪）将光标落入该标题附近 */
function scrollToHeading(headingId: string): void {
  const heading = findHeadingElement(headingId);
  if (!heading) return;

  scrollHeadingIntoMilkdownRoot(heading);
  heading.classList.add('toc-highlight');
  setTimeout(() => {
    heading.classList.remove('toc-highlight');
  }, 2000);

  if (!editor) return;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const pos = view.posAtDOM(heading, 0);
    if (!Number.isFinite(pos) || pos < 0) return;
    const max = view.state.doc.content.size;
    const clamped = Math.min(Math.max(1, pos), Math.max(1, max - 1));
    const $p = view.state.doc.resolve(clamped);
    view.dispatch(view.state.tr.setSelection(TextSelection.near($p)).scrollIntoView());
    view.focus();
  } catch (e) {
    console.warn('[Milkdown] scrollToHeading: could not move caret:', e);
  }
}

// 检查文档中是否已有 TOC
function hasToc(markdown: string): boolean {
  return TOC_REGEX.test(markdown);
}

// 更新文档中的 TOC
function updateTocInContent(markdown: string): string {
  const headings = extractHeadings(markdown);
  
  if (headings.length === 0) {
    // 如果没有标题，移除 TOC 标记
    return markdown.replace(TOC_REGEX, '').trim();
  }
  
  const tocMarkdown = generateTocMarkdown(headings);
  
  // 替换 TOC 标记
  return markdown.replace(TOC_REGEX, tocMarkdown);
}

onMounted(() => {
  if (!editorRef.value) {
    console.error('[MilkdownEditor] editorRef is null, cannot initialize');
    emit('ready', false);
    return;
  }

  // 使用 Promise 链而不是 async/await，避免 Vue 生命周期问题
  initEditor();
});

async function initEditor(): Promise<void> {
  try {
    // 检查必要的依赖是否加载
    if (!Editor || !commonmark || !gfm) {
      console.error('[MilkdownEditor] Required Milkdown modules not loaded');
      emit('ready', false);
      return;
    }

    setRuntimeRichPerfTier(props.richPerfEffectiveTier ?? 0);

    // M6-2 / M8-3：档 0 才加载 Shiki 插件；档 ≥1 不加载，减少首包与主线程压力。
    const shikiEnabled = (safeConfig.value as any)?.editor?.enableShiki === true && (props.richPerfEffectiveTier ?? 0) === 0;
    const buildEditor = async (withShiki: boolean): Promise<Editor> => {
      let b = Editor.make().config((ctx) => {
        ctx.set(rootCtx, editorRef.value);
        ctx.set(defaultValueCtx, props.content || '');
      });

      b = b.use(commonmark);
      b = b.use(gfm);
      // GFM preset 默认未启用列宽拖拽；补上后表格编辑体验更接近常见富文本编辑器
      b = b.use(columnResizingPlugin);
      b = b.use(marklyTableStructureKeymapPlugin);
      b = b.use(marklyTableGridPastePlugin);
      b = b.use(tableContextMilkdownPlugin);
      b = b.use(
        $prose(() =>
          keymap({
            Tab: (state, dispatch) => {
              try {
                if (isInTable(state)) return false;
              } catch {
                // ignore
              }
              const li = state.schema.nodes.list_item ?? (state.schema.nodes as any).listItem;
              if (!li) return false;
              return sinkListItem(li)(state, dispatch);
            },
            'Shift-Tab': (state, dispatch) => {
              try {
                if (isInTable(state)) return false;
              } catch {
                // ignore
              }
              const li = state.schema.nodes.list_item ?? (state.schema.nodes as any).listItem;
              if (!li) return false;
              return liftListItem(li)(state, dispatch);
            },
          })
        )
      );

      if (withShiki) {
        // M7-1：避免把 shiki 大包强行打进主 chunk；仅在启用时再动态加载插件实现
        const mod: any = await import('../plugins/shiki-highlight');
        const shikiHighlight = mod?.shikiHighlight;
        if (typeof shikiHighlight === 'function') b = b.use(shikiHighlight());
      }

      b = b.use(footnote);
      b = b.use(listener);
      b = b.use(history);
      return await b.create();
    };

    try {
      editor = await buildEditor(shikiEnabled);
    } catch (e) {
      if (shikiEnabled) {
        console.warn('[MilkdownEditor] create failed with shikiHighlight, retry without shiki:', e);
        editor = await buildEditor(false);
      } else {
        throw e;
      }
    }

    // 在 editor 创建完成后再注册 listener（此时 ctx 已完整注入）
    try {
      editor.ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        if (!isInternalChange) {
          lastEmittedContent = markdown;
          emit('change', markdown);
        }
      });
    } catch (e) {
      console.warn('[MilkdownEditor] listenerCtx not ready, skip markdownUpdated registration:', e);
    }

    console.log('[MilkdownEditor] Editor created successfully');

    // create() 完成后，watch 会接管后续 props.content 同步；避免在此处立即 setContent 触发早期 ctx 访问差异导致初始化失败。

    // 绑定图片点击事件
    bindImageEvents();

    // M8-1：先让 Rich 可交互，再排队初始化 Mermaid/视口渲染
    console.log('[MilkdownEditor] Emitting ready event');
    emit('ready', true);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(
        () => {
          initMermaid();
        },
        { timeout: 2000 }
      );
    } else {
      setTimeout(() => initMermaid(), 0);
    }
  } catch (error) {
    console.error('[MilkdownEditor] Failed to create editor:', error);
    console.error('[MilkdownEditor] Error stack:', (error as Error).stack);
    // 通知父组件编辑器初始化失败
    emit('ready', false);
  }
}

onUnmounted(() => {
  // 清除 updateTimeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }
  teardownMermaidObserver();
  mermaidRenderQueue.length = 0;
  mermaidQueuePump = false;

  // 移除图片事件监听器
  unbindImageEvents();
  
  if (editor) {
    try {
      editor.destroy();
    } catch (e) {
      // 关闭/重建 webview 时偶发触发 Milkdown ctx 清理竞态；不要让未捕获异常把 webview 打进红字 Error 页
      console.warn('[MilkdownEditor] destroy failed (ignored):', e);
    } finally {
      editor = null;
    }
  }
});

function teardownMermaidObserver(): void {
  mermaidObserver?.disconnect();
  mermaidObserver = null;
  mermaidRenderQueue.length = 0;
  mermaidQueuePump = false;
}

function setupMermaidAfterDom(): void {
  if (!editorRef.value) return;
  if ((props.richPerfEffectiveTier ?? 0) >= 2) return;
  teardownMermaidObserver();
  if (typeof IntersectionObserver === 'undefined') {
    void renderMermaidBlocksLegacy();
    return;
  }
  mermaidObserver = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const pre = en.target as HTMLPreElement;
          if (pre.dataset.mermaidRenderDone) continue;
          if (pre.dataset.mermaidRendered === 'error') continue;
          enqueueMermaidPre(pre);
        }
      }
    },
    { root: null, rootMargin: '200px 0px', threshold: 0.01 }
  );
  for (const pre of editorRef.value.querySelectorAll('pre.language-mermaid')) {
    mermaidObserver!.observe(pre);
  }
}

function enqueueMermaidPre(pre: HTMLPreElement): void {
  if (!pre.isConnected) return;
  if (pre.dataset.mermaidRenderDone) return;
  if (pre.dataset.mermaidRendered === 'error') return;
  if (pre.dataset.mermaidQueued) return;
  pre.dataset.mermaidQueued = '1';
  mermaidRenderQueue.push(pre);
  void pumpMermaidRenderQueue();
}

async function pumpMermaidRenderQueue(): Promise<void> {
  if (mermaidQueuePump) return;
  mermaidQueuePump = true;
  while (mermaidRenderQueue.length) {
    const pre = mermaidRenderQueue.shift()!;
    delete pre.dataset.mermaidQueued;
    if (!pre.isConnected) continue;
    if ((props.richPerfEffectiveTier ?? 0) >= 2) break;
    const m = await ensureMermaidLoaded();
    if (!m) break;
    await renderMermaidForPre(pre, m);
    await new Promise<void>((resolve) => {
      const w = window as unknown as { requestIdleCallback?: (c: () => void, o?: { timeout: number }) => void };
      if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 200 });
      else setTimeout(() => resolve(), 16);
    });
  }
  mermaidQueuePump = false;
}

async function renderMermaidForPre(
  pre: HTMLPreElement,
  m: NonNullable<Awaited<ReturnType<typeof ensureMermaidLoaded>>>
): Promise<void> {
  if ((props.richPerfEffectiveTier ?? 0) >= 2) return;
  const code = pre.querySelector('code');
  if (!code) {
    pre.dataset.mermaidRenderDone = '1';
    return;
  }
  const mermaidCode = code.textContent || '';
  if (!mermaidCode.trim()) {
    pre.dataset.mermaidRenderDone = '1';
    return;
  }
  try {
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let svg: string | null = mermaidSvgCache.get(mermaidCode) ?? null;
    if (!svg) {
      const r = await m.render(id, mermaidCode);
      svg = r.svg;
      mermaidSvgCache.set(mermaidCode, svg);
      if (mermaidSvgCache.size > MERMAID_SVG_CACHE_MAX) {
        const first = mermaidSvgCache.keys().next().value as string;
        mermaidSvgCache.delete(first);
      }
    }
    if (!pre.isConnected) return;
    const container = document.createElement('div');
    container.className = 'mermaid';
    container.dataset.mermaidRendered = 'true';
    container.innerHTML = svg;
    pre.parentNode?.replaceChild(container, pre);
  } catch (error) {
    console.error('Mermaid render error:', error);
    pre.dataset.mermaidRendered = 'error';
    pre.dataset.mermaidRenderDone = '1';
  }
}

async function renderMermaidBlocksLegacy(): Promise<void> {
  if (!editorRef.value) return;
  const m = await ensureMermaidLoaded();
  if (!m) return;
  for (const pre of editorRef.value.querySelectorAll('pre.language-mermaid')) {
    await renderMermaidForPre(pre as HTMLPreElement, m);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

// 初始化 mermaid（可重复调用；initialize 只执行一次）
function initMermaid(): void {
  void ensureMermaidLoaded()
    .then((m) => {
      if (!m) return;
      if (!mermaidRuntimeInitialized) {
        let theme = 'default';
        const config = safeConfig.value;
        if (config?.editor?.theme === 'dark') {
          theme = 'dark';
        } else if (config?.editor?.theme === 'auto') {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
        }
        try {
          m.initialize({
            startOnLoad: false,
            theme: theme,
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true },
            sequence: {
              useMaxWidth: true,
              diagramMarginX: 50,
              diagramMarginY: 10,
              actorMargin: 50,
              boxMargin: 10,
              boxTextMargin: 5,
              noteMargin: 10,
              messageMargin: 35,
            },
          });
          mermaidRuntimeInitialized = true;
        } catch (e) {
          console.warn('[MilkdownEditor] Mermaid init skipped:', e);
        }
      }
      nextTick(() => {
        nextTick(() => {
          if (mermaidApi && mermaidRuntimeInitialized) setupMermaidAfterDom();
        });
      });
    })
    .catch(() => {});
}

watch(
  () => props.content,
  (newContent) => {
    // 清除待处理的更新
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }

    // 如果是刚刚发出的内容变更，忽略这次更新，避免光标跳动
    if (newContent === lastEmittedContent) {
      return;
    }

    if (editor && newContent !== getContent()) {
      // 使用防抖机制
      pendingUpdate = { content: newContent, cursorPos: getCursorPosition() };
      scheduleUpdate();
    }
  }
);

watch(
  () => props.richPerfEffectiveTier,
  (t) => {
    setRuntimeRichPerfTier(t ?? 0);
    if (t === 2) {
      teardownMermaidObserver();
    } else {
      nextTick(() => {
        nextTick(() => {
          if ((props.richPerfEffectiveTier ?? 0) >= 2) return;
          if (mermaidApi && mermaidRuntimeInitialized) setupMermaidAfterDom();
          else initMermaid();
        });
      });
    }
  }
);

function scheduleUpdate(): void {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  updateTimeout = setTimeout(() => {
    if (pendingUpdate) {
      isInternalChange = true;
      setContent(pendingUpdate.content);

      // 注意：这里的 internalChange 只用于屏蔽“props 同步”引发的回传；不能覆盖用户紧随其后的真实编辑。
      // 用 microtask 尽快释放标志，避免 E2E/用户在 setContent 后立即插入节点时 content 回传被吞掉。
      queueMicrotask(() => {
        isInternalChange = false;
      });

      pendingUpdate = null;
    }
  }, 50);
}

function getCursorPosition(): number {
  if (!editor) return 0;
  try {
    const ctx = editor.ctx;
    const editorView = ctx.get(editorViewCtx);
    return editorView.state.selection.from;
  } catch {
    return 0;
  }
}

function getContent(): string {
  if (!editor) return '';
  try {
    const ctx = editor.ctx;
    const editorView = ctx.get(editorViewCtx);
    const doc = editorView.state.doc;
    const serializer = ctx.get(serializerCtx);
    return serializer(doc);
  } catch (e) {
    return props.content;
  }
}

function setContent(content: string): void {
  if (!editor) return;
  try {
    const ctx = editor.ctx;
    const editorView = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const newDoc = parser(content);
    if (!newDoc) return;

    const state = editorView.state;
    const oldDoc = state.doc;

    // 检查内容是否真的不同
    const oldText = oldDoc.textContent;
    const newText = newDoc.textContent;

    if (oldText === newText) {
      // 内容相同，跳过更新
      return;
    }

    // 保存当前光标位置
    const cursorPos = state.selection.from;
    const docSize = oldDoc.content.size;

    // 计算相对位置比例
    const relativeRatio = docSize > 0 ? cursorPos / docSize : 0;

    // 执行更新
    const tr = state.tr.replaceWith(0, state.doc.content.size, newDoc.content);

    // 恢复光标位置
    const newDocSize = tr.doc.content.size;
    const newCursorPos = Math.min(
      Math.round(relativeRatio * newDocSize),
      newDocSize
    );

    // 设置新的光标位置
    tr.setSelection(TextSelection.create(tr.doc, newCursorPos, newCursorPos));

    editorView.dispatch(tr);

    // Mermaid：视口可见时再渲染；档 2 跳过
    nextTick(() => {
      nextTick(() => {
        if ((props.richPerfEffectiveTier ?? 0) >= 2) return;
        if (mermaidApi && mermaidRuntimeInitialized) setupMermaidAfterDom();
        else initMermaid();
      });
    });
  } catch (e) {
    console.error('Failed to set content:', e);
  }
}

function applyFormat(format: string): void {
  if (!editor) return;

  const ctx = editor.ctx;
  let view;
  try {
    view = ctx.get(editorViewCtx);
  } catch (e) {
    // 编辑器尚未完全注入 editorViewCtx（启动/重建瞬间）时直接跳过，避免抛出 MilkdownError 让整个 webview 崩溃
    console.warn('[MilkdownEditor] applyFormat skipped (editorViewCtx not ready):', e);
    return;
  }
  const { state, dispatch } = view;
  const { marks, nodes } = state.schema;

  let command: any = null;

  switch (format) {
    case 'bold':
      command = toggleMark(marks.strong!);
      break;
    case 'italic':
      command = toggleMark(marks.em!);
      break;
    case 'strike':
      command = toggleMark(marks.strikethrough!);
      break;
    case 'code':
      command = toggleMark(marks.code_inline!);
      break;
    case 'highlight':
      if (marks.highlight) {
        command = toggleMark(marks.highlight);
      }
      break;
    case 'subscript':
      if (marks.subscript) {
        command = toggleMark(marks.subscript);
      }
      break;
    case 'superscript':
      if (marks.superscript) {
        command = toggleMark(marks.superscript);
      }
      break;
    case 'h1':
      command = setBlockType(nodes.heading!, { level: 1 });
      break;
    case 'h2':
      command = setBlockType(nodes.heading!, { level: 2 });
      break;
    case 'h3':
      command = setBlockType(nodes.heading!, { level: 3 });
      break;
    case 'h4':
      command = setBlockType(nodes.heading!, { level: 4 });
      break;
    case 'h5':
      command = setBlockType(nodes.heading!, { level: 5 });
      break;
    case 'h6':
      command = setBlockType(nodes.heading!, { level: 6 });
      break;
    case 'bulletList':
      command = wrapIn(nodes.bullet_list!);
      break;
    case 'orderedList':
      command = wrapIn(nodes.ordered_list!);
      break;
    case 'quote':
      command = wrapIn(nodes.blockquote!);
      break;
    case 'taskList':
      // 任务列表通过 insertNode 处理，这里调用它
      insertNode('taskList');
      return;
    case 'indent':
      // 缩进：使用 sinkListItem
      {
        const li = nodes.list_item ?? state.schema.nodes.list_item ?? (state.schema.nodes as any).listItem;
        if (li) command = sinkListItem(li);
      }
      break;
    case 'outdent':
      // 取消缩进：使用 liftListItem
      {
        const li = nodes.list_item ?? state.schema.nodes.list_item ?? (state.schema.nodes as any).listItem;
        if (li) command = liftListItem(li);
      }
      break;
    case 'clearFormat':
      clearFormat();
      return;
    default:
      console.log('Unknown format:', format);
      return;
  }

  if (command) {
    command(state, dispatch);
  }
}

function insertNode(type: string): void {
  if (!editor) return;

  const ctx = editor.ctx;
  let view;
  try {
    view = ctx.get(editorViewCtx);
  } catch (e) {
    console.warn('[MilkdownEditor] insertNode skipped (editorViewCtx not ready):', e);
    return;
  }
  const { state, dispatch } = view;
  const parser = ctx.get(parserCtx);

  let insertMarkdown = '';

  switch (type) {
    case 'link':
      insertMarkdown = '[链接文字](https://example.com)';
      break;
    case 'image':
      insertMarkdown = '![图片描述](图片地址)';
      break;
    case 'codeBlock':
      insertMarkdown = '\n```\n代码内容\n```\n';
      break;
    case 'table':
      insertMarkdown = '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n';
      break;
    case 'hr':
      insertMarkdown = '\n---\n';
      break;
    case 'taskList':
      insertMarkdown = '- [ ] 任务项\n';
      break;
    case 'math':
      insertMarkdown = '\n$$\nE = mc^2\n$$\n';
      break;
    case 'footnote':
      insertMarkdown = '[^1]\n\n[^1]: 脚注内容\n';
      break;
    case 'toc':
      // 插入 TOC 标记
      insertMarkdown = `\n${TOC_PLACEHOLDER}\n`;
      break;
    default:
      console.log('Unknown insert type:', type);
      return;
  }

  // 使用 parser 将 markdown 转换为 ProseMirror 节点
  const doc = parser(insertMarkdown);
  if (doc) {
    const { from, to } = state.selection;
    const tr = state.tr.replaceWith(from, to, doc.content);
    dispatch(tr);
  }
}

// 解析图片 URL（处理相对路径）
function resolveImageUrl(src: string): string {
  if (!src) return '';
  
  // 如果已经是绝对 URL，直接返回
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('file://')) {
    return src;
  }
  
  // 使用 baseUrl 解析相对路径
  const baseUrl = props.baseUrl || '';
  if (baseUrl) {
    return new URL(src, baseUrl).href;
  }
  
  // 如果没有 baseUrl，但有 base 标签，使用 document.baseURI
  if (document.baseURI) {
    return new URL(src, document.baseURI).href;
  }
  
  return src;
}

// 绑定图片和链接事件
function bindImageEvents(): void {
  if (!editorRef.value) return;

  // 创建事件处理函数并保存引用
  imageClickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 检查是否是 TOC 链接
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      // 检查是否是标题锚点链接
      if (href.startsWith('#')) {
        e.preventDefault();
        const headingId = href.substring(1);
        emit('toc-click', headingId);
        scrollToHeading(headingId);
        return;
      }
    }
    
    if (target.tagName === 'IMG') {
      const src = target.getAttribute('src') || '';
      // 解析相对路径为完整 URL
      const resolvedSrc = resolveImageUrl(src);
      
      const images = Array.from(editorRef.value?.querySelectorAll('img') || [])
        .map((img) => resolveImageUrl(img.getAttribute('src') || ''));
      const index = images.indexOf(resolvedSrc);
      emit('image-click', resolvedSrc, images, index);
    }
  };

  imageContextMenuHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      const src = target.getAttribute('src') || '';
      // 解析相对路径为完整 URL
      const resolvedSrc = resolveImageUrl(src);
      emit('image-context-menu', resolvedSrc, e.clientX, e.clientY);
    }
  };

  tableContextMenuHandler = (e: MouseEvent) => {
    if (!editor) return;
    try {
      const view = editor.ctx.get(editorViewCtx);
      const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (hit?.pos != null) {
        const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, hit.pos)).scrollIntoView();
        view.dispatch(tr);
      }
      const inTable = isInTable(view.state);
      if (!inTable) return;
      e.preventDefault();
      emit('table-context-menu', { x: e.clientX, y: e.clientY });
    } catch (err) {
      console.warn('Failed to handle table context menu:', err);
    }
  };

  editorRef.value.addEventListener('click', imageClickHandler);
  editorRef.value.addEventListener('contextmenu', imageContextMenuHandler);
  editorRef.value.addEventListener('contextmenu', tableContextMenuHandler);
}

// 移除图片事件监听
function unbindImageEvents(): void {
  if (editorRef.value) {
    if (imageClickHandler) {
      editorRef.value.removeEventListener('click', imageClickHandler);
      imageClickHandler = null;
    }
    if (imageContextMenuHandler) {
      editorRef.value.removeEventListener('contextmenu', imageContextMenuHandler);
      imageContextMenuHandler = null;
    }
    if (tableContextMenuHandler) {
      editorRef.value.removeEventListener('contextmenu', tableContextMenuHandler);
      tableContextMenuHandler = null;
    }
  }
}

function undo(): void {
  if (!editor) return;
  try {
    callCommand(undoCommand)(editor.ctx);
  } catch (e) {
    console.error('Failed to undo:', e);
  }
}

function redo(): void {
  if (!editor) return;
  try {
    callCommand(redoCommand)(editor.ctx);
  } catch (e) {
    console.error('Failed to redo:', e);
  }
}

/**
 * 在 ProseMirror 文档的「扁平文本」中选中第 occurrence 次出现的 needle（UTF-16 索引与 JS 一致）。
 * 用于 Rich 模式查找：与 markdown 上的第 n 个匹配尽量对齐。
 */
function selectPlainTextOccurrence(needle: string, occurrence: number): boolean {
  if (!editor || !needle) return false;
  if (occurrence < 0) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state } = view;
    const units: Array<{ c: string; from: number }> = [];
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const t = node.text;
        for (let i = 0; i < t.length; i++) {
          units.push({ c: t[i]!, from: pos + 1 + i });
        }
      }
    });
    const flat = units.map((u) => u.c).join('');
    let at = -1;
    for (let i = 0; i <= occurrence; i++) {
      at = flat.indexOf(needle, at + 1);
      if (at < 0) return false;
    }
    const endChar = at + needle.length - 1;
    if (endChar >= units.length) return false;
    const from = units[at]!.from;
    const to = units[endChar]!.from + 1;
    const sel = TextSelection.create(state.doc, from, to);
    view.dispatch(state.tr.setSelection(sel).scrollIntoView());
    view.focus();
    return true;
  } catch (e) {
    console.warn('[Milkdown] selectPlainTextOccurrence failed:', e);
    return false;
  }
}

function clearFormat(): void {
  if (!editor) return;
  try {
    const ctx = editor.ctx;
    const view = ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    const { marks } = state.schema;
    const { from, to } = state.selection;

    // 移除所有行内格式标记
    let tr = state.tr;
    const markTypes = ['strong', 'em', 'strikethrough', 'code_inline', 'highlight', 'subscript', 'superscript'];

    markTypes.forEach(markName => {
      const markType = marks[markName];
      if (markType) {
        tr = tr.removeMark(from, to, markType);
      }
    });

    dispatch(tr);
  } catch (e) {
    console.error('Failed to clear format:', e);
  }
}

function dispatchRichTableOp(op: RichTableOp): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    return runRichTableOp(view, op);
  } catch {
    return false;
  }
}

function simulateRichTablePaste(payload: { plain?: string; html?: string }): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    view.focus();
    const html = payload.html ?? '';
    const plain = payload.plain ?? '';

    // CellSelection：直接按“填充粘贴（不扩表）”规则执行（用于 E2E，避免 DOM paste 丢失 CellSelection）
    if (view.state.selection instanceof CellSelection) {
      const parsed = parseTablePasteMatrix(html, plain);
      const normPlain = String(plain ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const grid =
        parsed.grid ??
        // 单列多行：作为 Hx1，允许 repeatCol
        (() => {
          if (!normPlain.trim()) return null;
          if (normPlain.includes('\t')) return null;
          if (normPlain.includes(',')) return null;
          if (!normPlain.includes('\n')) return null;
          const lines = normPlain.split('\n');
          while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
          if (lines.length <= 1) return null;
          return lines.map((ln) => [String(ln ?? '').trim()]);
        })() ??
        // 单值：作为 1x1，走 broadcast
        (normPlain.trim() && !normPlain.includes('\n') && !normPlain.includes('\t') ? [[normPlain.trim()]] : null);
      if (!grid) return false;

      const rect = selectedRect(view.state);
      const table = view.state.doc.nodeAt(rect.tableStart - 1);
      if (!table) return false;
      const map = TableMap.get(table);
      const selHeight = rect.bottom - rect.top;
      const selWidth = rect.right - rect.left;
      const mapping = decideTableGridSelectionFillMapping({
        gridHeight: grid.length,
        gridWidth: Math.max(1, ...grid.map((r) => r.length)),
        selHeight,
        selWidth,
      });
      if (mapping.mode === 'reject') return false;

      let tr = view.state.tr;
      const { schema } = view.state;
      for (let r = 0; r < selHeight; r++) {
        for (let c = 0; c < selWidth; c++) {
          const row = rect.top + r;
          const col = rect.left + c;
          const cellOffset = map.map[row * map.width + col];
          if (cellOffset == null) continue;
          const cellPos = rect.tableStart + cellOffset;
          const cellNode = tr.doc.nodeAt(cellPos);
          if (!cellNode) continue;

          const pick = () => {
            if (mapping.mode === 'broadcast') return grid[0]?.[0] ?? '';
            if (mapping.mode === 'exact') return grid[r]?.[c] ?? '';
            if (mapping.mode === 'repeatRow') return grid[0]?.[c] ?? '';
            if (mapping.mode === 'repeatCol') return grid[r]?.[0] ?? '';
            return '';
          };

          const text = String(pick() ?? '');
          const para = schema.nodes.paragraph?.create(null, text ? schema.text(text) : null);
          if (!para) continue;
          tr = tr.replaceWith(cellPos + 1, cellPos + cellNode.nodeSize - 1, Fragment.from(para));
        }
      }
      if (!tr.docChanged) return false;
      view.dispatch(tr.scrollIntoView());
      return true;
    }

    // 其它场景：复用真实 paste 事件链
    try {
      const evt = new Event('paste', { bubbles: true, cancelable: true }) as any;
      Object.defineProperty(evt, 'clipboardData', {
        value: {
          getData: (t: string) => (t === 'text/html' ? html : t === 'text/plain' ? plain : ''),
        },
      });
      view.dom.dispatchEvent(evt);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function setRichTableCellSelection(payload: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state } = view;
    const sel = state.selection;
    const $from = sel.$from;
    let tableDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tableDepth = d;
        break;
      }
    }
    if (tableDepth < 0) return false;

    const table = $from.node(tableDepth);
    const tablePos = $from.before(tableDepth);
    const tableStart = tablePos + 1;
    const map = TableMap.get(table);

    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
    const rs = clamp(Math.floor(payload.rowStart), 0, map.height - 1);
    const re = clamp(Math.floor(payload.rowEnd), 0, map.height - 1);
    const cs = clamp(Math.floor(payload.colStart), 0, map.width - 1);
    const ce = clamp(Math.floor(payload.colEnd), 0, map.width - 1);
    const rowStart = Math.min(rs, re);
    const rowEnd = Math.max(rs, re);
    const colStart = Math.min(cs, ce);
    const colEnd = Math.max(cs, ce);

    const anchorCell = tableStart + map.positionAt(rowStart, colStart, table);
    const headCell = tableStart + map.positionAt(rowEnd, colEnd, table);
    const nextSel = new CellSelection(state.doc.resolve(anchorCell), state.doc.resolve(headCell));
    view.dispatch(state.tr.setSelection(nextSel).scrollIntoView());
    view.focus();
    return true;
  } catch (e) {
    console.warn('[Milkdown] setRichTableCellSelection failed:', e);
    return false;
  }
}

function e2eSelectFirstTableBodyCell(): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state } = view;
    let tablePos: number | null = null;
    let tableNode: any = null;
    state.doc.descendants((node, pos) => {
      if (tablePos != null) return false;
      if (node?.type?.name === 'table') {
        tablePos = pos;
        tableNode = node;
        return false;
      }
      return true;
    });
    if (tablePos == null || !tableNode) return false;
    const map = TableMap.get(tableNode);
    const row = Math.min(1, Math.max(0, map.height - 1));
    const col = 0;
    const cellOffset = map.positionAt(row, col, tableNode);
    const cellPos = tablePos + 1 + cellOffset;
    const tr = state.tr.setSelection(TextSelection.create(state.doc, cellPos + 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch {
    return false;
  }
}

function e2eSetCellSelectionInFirstTable(payload: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state } = view;
    let tablePos: number | null = null;
    let tableNode: any = null;
    state.doc.descendants((node, pos) => {
      if (tablePos != null) return false;
      if (node?.type?.name === 'table') {
        tablePos = pos;
        tableNode = node;
        return false;
      }
      return true;
    });
    if (tablePos == null || !tableNode) return false;
    const map = TableMap.get(tableNode);
    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
    const rs = clamp(Math.floor(payload.rowStart), 0, map.height - 1);
    const re = clamp(Math.floor(payload.rowEnd), 0, map.height - 1);
    const cs = clamp(Math.floor(payload.colStart), 0, map.width - 1);
    const ce = clamp(Math.floor(payload.colEnd), 0, map.width - 1);
    const rowStart = Math.min(rs, re);
    const rowEnd = Math.max(rs, re);
    const colStart = Math.min(cs, ce);
    const colEnd = Math.max(cs, ce);
    const anchor = tablePos + 1 + map.positionAt(rowStart, colStart, tableNode);
    const head = tablePos + 1 + map.positionAt(rowEnd, colEnd, tableNode);
    const nextSel = new CellSelection(state.doc.resolve(anchor), state.doc.resolve(head));
    view.dispatch(state.tr.setSelection(nextSel).scrollIntoView());
    view.focus();
    return true;
  } catch {
    return false;
  }
}

function e2eSelectListItemText(payload: { index: number }): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state } = view;
    const want = Math.max(0, Math.floor(payload.index));
    let seen = 0;
    let foundPos: number | null = null;
    let foundNodeSize = 0;
    state.doc.descendants((node, pos) => {
      if (foundPos != null) return false;
      const name = node?.type?.name;
      if (name === 'list_item' || name === 'listItem') {
        if (seen === want) {
          foundPos = pos;
          foundNodeSize = node.nodeSize;
          return false;
        }
        seen++;
      }
      return true;
    });
    if (foundPos == null) return false;

    // 在该 list_item 内部找第一个 textblock，把 selection 放到它的起始位置
    let textblockPos: number | null = null;
    state.doc.nodesBetween(foundPos, foundPos + foundNodeSize, (node, pos) => {
      if (textblockPos != null) return false;
      if (node.isTextblock) {
        textblockPos = pos + 1;
        return false;
      }
      return true;
    });
    const target = textblockPos ?? foundPos + 2;
    const tr = state.tr.setSelection(TextSelection.create(state.doc, target)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch {
    return false;
  }
}

function e2ePressTab(payload?: { shift?: boolean }): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    view.focus();
    const shift = Boolean(payload?.shift);
    const evt: any = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    view.dom.dispatchEvent(evt);
    return true;
  } catch {
    return false;
  }
}

function e2eIndentListItem(): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    const li =
      state.schema.nodes.list_item ??
      (state.schema.nodes as any).listItem ??
      Object.values(state.schema.nodes).find((n: any) => n?.name === 'list_item' || n?.name === 'listItem');
    if (!li) return false;
    return Boolean(sinkListItem(li as any)(state, dispatch));
  } catch {
    return false;
  }
}

function e2eOutdentListItem(): boolean {
  if (!editor) return false;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    const li =
      state.schema.nodes.list_item ??
      (state.schema.nodes as any).listItem ??
      Object.values(state.schema.nodes).find((n: any) => n?.name === 'list_item' || n?.name === 'listItem');
    if (!li) return false;
    return Boolean(liftListItem(li as any)(state, dispatch));
  } catch {
    return false;
  }
}

function getPmSelectionDiagnostics():
  | {
      from: number;
      to: number;
      parentType: string;
      depth: number;
      inTable: boolean;
      inList: boolean;
      cellType: string | null;
    }
  | null {
  if (!editor) return null;
  try {
    const view = editor.ctx.get(editorViewCtx);
    const sel = view.state.selection;
    const $from = sel.$from;
    let inTable = false;
    let inList = false;
    let cellType: string | null = null;
    for (let d = $from.depth; d > 0; d--) {
      const name = $from.node(d).type.name;
      if (name === 'table') inTable = true;
      if (name === 'table_cell' || name === 'table_header') cellType = name;
      if (name === 'list_item' || name === 'listItem') inList = true;
    }
    return {
      from: sel.from,
      to: sel.to,
      parentType: $from.parent.type.name,
      depth: $from.depth,
      inTable,
      inList,
      cellType,
    };
  } catch {
    return null;
  }
}

defineExpose({
  applyFormat,
  insertNode,
  getContent,
  setContent,
  selectPlainTextOccurrence,
  getPmSelectionDiagnostics,
  runRichTableOp: dispatchRichTableOp,
  simulateRichTablePaste,
  setRichTableCellSelection,
  e2eSelectFirstTableBodyCell,
  e2eSetCellSelectionInFirstTable,
  e2eSelectListItemText,
  e2ePressTab,
  e2eIndentListItem,
  e2eOutdentListItem,
  undo,
  redo,
  // TOC 相关功能
  insertToc: () => insertNode('toc'),
  updateToc: () => {
    const content = getContent();
    if (hasToc(content)) {
      const updatedContent = updateTocInContent(content);
      setContent(updatedContent);
    }
  },
  hasToc,
  extractHeadings,
  scrollToHeading,
});
</script>

<style>
.milkdown-editor {
  flex: 1;
  min-height: 0;
  outline: none;
  padding: 24px;
  overflow-y: auto;
  overflow-x: auto;
  /* 允许长英文/URL 在编辑区内断行，避免被裁切 */
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ProseMirror 编辑器样式 */
.milkdown-editor .editor {
  font-family: v-bind('safeConfig.editor.fontFamily');
  font-size: v-bind('safeConfig.editor.fontSize * 1.5 + "px"');
  line-height: 1.6;
  outline: none;
  min-height: 100%;
}

/* 光标样式 */
.milkdown-editor .ProseMirror {
  outline: none;
  min-height: 100%;
}

.milkdown-editor .ProseMirror-focused {
  outline: none;
}

/* 选区样式 */
.milkdown-editor .ProseMirror-selectednode {
  background: var(--vscode-editor-selectionBackground);
}

/* 光标（caret）样式 - 确保可见 */
.milkdown-editor .ProseMirror-caret {
  border-left: 2px solid var(--vscode-editor-foreground);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 确保编辑区域可以获取焦点 */
.milkdown-editor .ProseMirror-content {
  outline: none;
  min-height: 100%;
}

.milkdown-editor h1 {
  font-size: 2.2em;
  font-weight: 600;
  margin: 0.5em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
}

.milkdown-editor h2 {
  font-size: 1.7em;
  font-weight: 600;
  margin: 0.5em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
}

.milkdown-editor h3 {
  font-size: 1.4em;
  font-weight: 600;
  margin: 0.5em 0;
}

.milkdown-editor h4 {
  font-size: 1.2em;
  font-weight: 600;
  margin: 0.5em 0;
}

.milkdown-editor h5 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.5em 0;
}

.milkdown-editor h6 {
  font-size: 1em;
  font-weight: 600;
  margin: 0.5em 0;
  color: var(--vscode-descriptionForeground);
}

/* 高亮样式 */
.milkdown-editor mark {
  background: rgba(255, 235, 59, 0.4);
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

/* 上下标样式 */
.milkdown-editor sub,
.milkdown-editor sup {
  font-size: 0.75em;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

.milkdown-editor sup {
  top: -0.5em;
}

.milkdown-editor sub {
  bottom: -0.25em;
}

/* 数学公式样式 */
.milkdown-editor .math-display {
  overflow-x: auto;
  padding: 1em 0;
  text-align: center;
}

.milkdown-editor .math-inline {
  display: inline;
}

.milkdown-editor p {
  margin: 0.5em 0;
}

.milkdown-editor img {
  max-width: 100%;
  height: auto;
  cursor: pointer;
  border-radius: 4px;
}

.milkdown-editor img:hover {
  box-shadow: 0 0 0 2px var(--vscode-focusBorder);
}

.milkdown-editor code {
  background: var(--vscode-textCodeBlock-background);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
}

.milkdown-editor pre {
  background: var(--vscode-textCodeBlock-background);
  padding: 24px;
  border-radius: 12px;
  overflow-x: auto;
}

.milkdown-editor pre code {
  padding: 0;
  background: transparent;
}

/* Shiki 代码高亮样式 */
.milkdown-editor .shiki-wrapper {
  background: var(--vscode-textCodeBlock-background);
  border-radius: 12px;
  overflow: hidden;
}

.milkdown-editor .shiki {
  background: transparent !important;
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: var(--vscode-editor-font-family);
  font-size: 14px;
  line-height: 1.5;
}

/* Shiki 颜色变量 - 亮色主题 */
.milkdown-editor .shiki {
  color: var(--vscode-editor-foreground);
}

/* 确保代码块有正确的背景 */
.milkdown-editor pre[class*="language-"],
.milkdown-editor code[class*="language-"] {
  background: var(--vscode-textCodeBlock-background);
  border-radius: 6px;
}

/* 保留 Prism 样式作为后备 */
.milkdown-editor code .token.comment,
.milkdown-editor code .token.prolog,
.milkdown-editor code .token.doctype,
.milkdown-editor code .token.cdata {
  color: var(--vscode-descriptionForeground);
}

.milkdown-editor code .token.punctuation {
  color: var(--vscode-editor-foreground);
}

.milkdown-editor code .token.property,
.milkdown-editor code .token.tag,
.milkdown-editor code .token.boolean,
.milkdown-editor code .token.number,
.milkdown-editor code .token.constant,
.milkdown-editor code .token.symbol {
  color: #b5cea8;
}

.milkdown-editor code .token.selector,
.milkdown-editor code .token.attr-name,
.milkdown-editor code .token.string,
.milkdown-editor code .token.char,
.milkdown-editor code .token.builtin {
  color: #ce9178;
}

.milkdown-editor code .token.operator,
.milkdown-editor code .token.entity,
.milkdown-editor code .token.url,
.milkdown-editor code .language-css .token.string,
.milkdown-editor code .style .token.string {
  color: #d4d4d4;
}

.milkdown-editor code .token.atrule,
.milkdown-editor code .token.attr-value,
.milkdown-editor code .token.keyword {
  color: #569cd6;
}

.milkdown-editor code .token.function,
.milkdown-editor code .token.class-name {
  color: #dcdcaa;
}

.milkdown-editor code .token.regex,
.milkdown-editor code .token.important,
.milkdown-editor code .token.variable {
  color: #d16969;
}

/* Mermaid 图表样式 */
.milkdown-editor .mermaid {
  text-align: center;
  padding: 1em 0;
}

.milkdown-editor .mermaid svg {
  max-width: 100%;
  height: auto;
}

.milkdown-editor blockquote {
  border-left: 4px solid var(--vscode-textBlockQuote-border);
  margin: 0.5em 0;
  padding-left: 1em;
  color: var(--vscode-textBlockQuote-foreground);
}

.milkdown-editor table {
  border-collapse: collapse;
  /* 让表格既能占满可视宽度，又能在内容过宽时触发横向滚动 */
  width: max-content;
  min-width: 100%;
  margin: 0.5em 0;
}

.milkdown-editor th,
.milkdown-editor td {
  border: 1px solid var(--vscode-editorWidget-border);
  padding: 12px 18px;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.milkdown-editor th {
  background: var(--vscode-editor-inactiveSelectionBackground);
  font-weight: 600;
}

.milkdown-editor ul,
.milkdown-editor ol {
  padding-left: 2em;
  margin: 0.5em 0;
}

/* TOC 高亮样式 */
.milkdown-editor .toc-highlight {
  background: rgba(255, 235, 59, 0.4);
  transition: background 0.3s ease;
}

/* TOC 链接样式 */
.milkdown-editor .toc-link {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  cursor: pointer;
}

.milkdown-editor .toc-link:hover {
  text-decoration: underline;
}
</style>
