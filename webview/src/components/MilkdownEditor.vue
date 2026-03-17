<template>
  <div class="milkdown-editor" ref="editorRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { math } from '@milkdown/plugin-math';
// 使用 Shiki 替代 Prism 做代码高亮
import { shikiHighlight } from '../plugins/shiki-highlight';
import { diagram } from '@milkdown/plugin-diagram';
import { footnote } from '../plugins/footnote';
import { listEdit } from '../plugins/listEdit';
import { callCommand } from '@milkdown/utils';
import { undoCommand, redoCommand } from '@milkdown/plugin-history';
import { toggleMark, wrapIn, setBlockType } from '@milkdown/prose/commands';
import { liftListItem, sinkListItem } from '@milkdown/prose/schema-list';
import { TextSelection } from '@milkdown/prose/state';
import { schema } from '@milkdown/preset-commonmark';
import type { ExtensionConfig } from '../../src/types';
import mermaid from 'mermaid';

// TOC 标记
const TOC_PLACEHOLDER = '<!-- TOC -->';
const TOC_REGEX = /<!--\s*TOC\s*-->/gi;

const props = defineProps<{
  content: string;
  config: ExtensionConfig;
  baseUrl?: string; // 用于解析相对图片路径
}>();

// 防御性 computed：为 config 提供默认值（优化：避免每次创建新对象）
const defaultConfig = {
  editor: {
    fontFamily: 'SF Mono, Consolas, monospace',
    fontSize: 14,
    theme: 'light',
    lineNumbers: false,
    wordWrap: 'on',
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
}>();

const editorRef = ref<HTMLElement | null>(null);
let editor: Editor | null = null;
let isInternalChange = false;
let lastEmittedContent = '';
let pendingUpdate: { content: string; cursorPos: number } | null = null;
let updateTimeout: ReturnType<typeof setTimeout> | null = null;

// 图片事件处理函数引用（用于清理）
let imageClickHandler: ((e: MouseEvent) => void) | null = null;
let imageContextMenuHandler: ((e: MouseEvent) => void) | null = null;

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

// 跳转到的标题 ID
function scrollToHeading(headingId: string): void {
  if (!editorRef.value) return;
  
  // 查找具有对应 ID 的标题元素
  const heading = editorRef.value.querySelector(`[id="${headingId}"]`) as HTMLElement;
  
  if (heading) {
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 添加高亮效果
    heading.classList.add('toc-highlight');
    setTimeout(() => {
      heading.classList.remove('toc-highlight');
    }, 2000);
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
  console.log('[MilkdownEditor] onMounted called');
  console.log('[MilkdownEditor] editorRef:', editorRef.value);
  console.log('[MilkdownEditor] content length:', props.content?.length);

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
    console.log('[MilkdownEditor] Starting editor initialization...');

    // 检查必要的依赖是否加载
    if (!Editor || !commonmark || !gfm) {
      console.error('[MilkdownEditor] Required Milkdown modules not loaded');
      emit('ready', false);
      return;
    }

    console.log('[MilkdownEditor] Creating editor instance...');

    // 逐步初始化，便于定位问题
    let editorBuilder = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.value);
        ctx.set(defaultValueCtx, props.content || '');

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          if (!isInternalChange) {
            lastEmittedContent = markdown;
            emit('change', markdown);
          }
        });
      });

    console.log('[MilkdownEditor] Adding commonmark plugin...');
    editorBuilder = editorBuilder.use(commonmark);

    console.log('[MilkdownEditor] Adding gfm plugin...');
    editorBuilder = editorBuilder.use(gfm);

    console.log('[MilkdownEditor] Adding math plugin...');
    editorBuilder = editorBuilder.use(math);

    // 暂时禁用 Shiki 高亮，看看是否是它导致的问题
    console.log('[MilkdownEditor] Skipping Shiki highlight for debugging...');
    // editorBuilder = editorBuilder.use(shikiHighlight({
    //   themes: {
    //     light: 'github-light',
    //     dark: 'github-dark',
    //   },
    // }));

    console.log('[MilkdownEditor] Adding diagram plugin...');
    editorBuilder = editorBuilder.use(diagram);

    console.log('[MilkdownEditor] Adding footnote plugin...');
    editorBuilder = editorBuilder.use(footnote);

    // 暂时禁用 listEdit 插件，它可能访问未初始化的 schema
    console.log('[MilkdownEditor] Skipping listEdit plugin for debugging...');
    // editorBuilder = editorBuilder.use(listEdit);

    console.log('[MilkdownEditor] Adding listener plugin...');
    editorBuilder = editorBuilder.use(listener);

    console.log('[MilkdownEditor] Adding history plugin...');
    editorBuilder = editorBuilder.use(history);

    console.log('[MilkdownEditor] Creating editor...');
    editor = await editorBuilder.create();

    console.log('[MilkdownEditor] Editor created successfully');

    // 绑定图片点击事件
    bindImageEvents();

    // 初始化 mermaid
    initMermaid();

    // 通知父组件编辑器已准备好
    console.log('[MilkdownEditor] Emitting ready event');
    emit('ready', true);
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
  
  // 移除图片事件监听器
  unbindImageEvents();
  
  if (editor) {
    editor.destroy();
    editor = null;
  }
});

// 初始化 mermaid
function initMermaid(): void {
  // 确定主题
  let theme = 'default';
  const config = safeConfig.value;
  if (config?.editor?.theme === 'dark') {
    theme = 'dark';
  } else if (config?.editor?.theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
  }
  
  mermaid.initialize({
    startOnLoad: false,
    theme: theme,
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
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
  
  // 延迟渲染 mermaid 代码块，确保 DOM 已准备好
  // 使用双 nextTick 确保编辑器 DOM 完全渲染
  nextTick(() => {
    nextTick(() => {
      renderMermaidBlocks();
    });
  });
}

// 渲染 mermaid 代码块
async function renderMermaidBlocks(): Promise<void> {
  if (!editorRef.value) return;
  
  // 只查找未渲染的 mermaid 代码块
  // 注意：渲染后的 mermaid 会变成 div.mermaid，不再是 pre.language-mermaid
  // 所以直接查询 pre.language-mermaid 即可，无需依赖 dataset 标记
  const codeBlocks = editorRef.value.querySelectorAll('pre.language-mermaid');
  
  for (const pre of codeBlocks) {
    const code = pre.querySelector('code');
    if (!code) continue;
    
    const mermaidCode = code.textContent || '';
    if (!mermaidCode.trim()) continue;
    
    try {
      // 生成唯一 ID
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 使用 mermaid 渲染
      const { svg } = await mermaid.render(id, mermaidCode);
      
      // 创建容器
      const container = document.createElement('div');
      container.className = 'mermaid';
      container.dataset.mermaidRendered = 'true'; // 标记已渲染
      container.innerHTML = svg;
      
      // 替换原来的 pre 元素
      pre.parentNode?.replaceChild(container, pre);
    } catch (error) {
      console.error('Mermaid render error:', error);
      // 标记渲染失败
      pre.dataset.mermaidRendered = 'error';
    }
  }
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

function scheduleUpdate(): void {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  updateTimeout = setTimeout(() => {
    if (pendingUpdate) {
      isInternalChange = true;
      setContent(pendingUpdate.content);

      // 使用 requestAnimationFrame 确保在下一帧重置标志
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isInternalChange = false;
        });
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

function setCursorPosition(pos: number): void {
  if (!editor) return;
  try {
    const ctx = editor.ctx;
    const editorView = ctx.get(editorViewCtx);
    const { state, dispatch } = editorView;
    const safePos = Math.max(0, Math.min(pos, state.doc.content.size));
    const tr = state.tr.setSelection(TextSelection.create(state.doc, safePos, safePos));
    dispatch(tr);
    // 滚动到光标位置
    const coords = editorView.coordsAtPos(safePos);
    const editorRect = editorRef.value?.getBoundingClientRect();
    if (editorRect && coords.top < editorRect.top) {
      editorRef.value?.scrollTo({ top: coords.top - editorRect.top - 50, behavior: 'smooth' });
    } else if (editorRect && coords.top > editorRect.bottom) {
      editorRef.value?.scrollTo({ top: coords.top - editorRect.top + 50, behavior: 'smooth' });
    }
  } catch (e) {
    console.error('Failed to set cursor position:', e);
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

    // 渲染 mermaid 代码块
    nextTick(() => {
      renderMermaidBlocks();
    });
  } catch (e) {
    console.error('Failed to set content:', e);
  }
}

function applyFormat(format: string): void {
  if (!editor) return;

  const ctx = editor.ctx;
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { marks, nodes } = state.schema;

  let command: any = null;

  // 检查 marks 是否存在
  if (!marks) {
    console.warn('Marks not available');
    return;
  }

  switch (format) {
    case 'bold':
      if (!marks.strong) {
        console.warn('Strong mark not available');
        return;
      }
      command = toggleMark(marks.strong);
      break;
    case 'italic':
      if (!marks.em) {
        console.warn('Em mark not available');
        return;
      }
      command = toggleMark(marks.em);
      break;
    case 'strike':
      if (!marks.strikethrough) {
        console.warn('Strikethrough mark not available');
        return;
      }
      command = toggleMark(marks.strikethrough);
      break;
    case 'code':
      if (!marks.code_inline) {
        console.warn('Code_inline mark not available');
        return;
      }
      command = toggleMark(marks.code_inline);
      break;
    case 'highlight':
      if (marks?.highlight) {
        command = toggleMark(marks.highlight);
      } else {
        console.warn('Highlight mark not available');
        return;
      }
      break;
    case 'subscript':
      if (marks?.subscript) {
        command = toggleMark(marks.subscript);
      } else {
        console.warn('Subscript mark not available');
        return;
      }
      break;
    case 'superscript':
      if (marks?.superscript) {
        command = toggleMark(marks.superscript);
      } else {
        console.warn('Superscript mark not available');
        return;
      }
      break;
    case 'h1':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 1 });
      break;
    case 'h2':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 2 });
      break;
    case 'h3':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 3 });
      break;
    case 'h4':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 4 });
      break;
    case 'h5':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 5 });
      break;
    case 'h6':
      if (!nodes?.heading) {
        console.warn('Heading node not available');
        return;
      }
      command = setBlockType(nodes.heading, { level: 6 });
      break;
    case 'bulletList':
      if (!nodes?.bullet_list) {
        console.warn('Bullet_list node not available');
        return;
      }
      command = wrapIn(nodes.bullet_list);
      break;
    case 'orderedList':
      if (!nodes?.ordered_list) {
        console.warn('Ordered_list node not available');
        return;
      }
      command = wrapIn(nodes.ordered_list);
      break;
    case 'quote':
      if (!nodes?.blockquote) {
        console.warn('Blockquote node not available');
        return;
      }
      command = wrapIn(nodes.blockquote);
      break;
    case 'taskList':
      // 任务列表通过 insertNode 处理，这里调用它
      insertNode('taskList');
      return;
    case 'indent':
      // 缩进：使用 sinkListItem
      if (nodes.list_item) {
        command = sinkListItem(nodes.list_item);
      }
      break;
    case 'outdent':
      // 取消缩进：使用 liftListItem
      if (nodes.list_item) {
        command = liftListItem(nodes.list_item);
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
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const parser = ctx.get(parserCtx);

  let insertMarkdown = '';

  // 计算插入后的光标位置（用于选中占位符文本）
  let selectFrom = 0;
  let selectTo = 0;

  switch (type) {
    case 'link':
      // 插入占位符，并计算选区
      insertMarkdown = '[链接文字](url)';
      selectFrom = 1;  // 选中 "链接文字"
      selectTo = 5;
      break;
    case 'image':
      insertMarkdown = '![图片描述](图片地址)';
      selectFrom = 2;  // 选中 "图片描述"
      selectTo = 6;
      break;
    case 'codeBlock':
      insertMarkdown = '\n```\n代码内容\n```\n';
      selectFrom = 5;  // 选中 "代码内容"
      selectTo = 9;
      break;
    case 'table':
      insertMarkdown = '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n';
      selectFrom = 0;  // 不选中特定文本
      selectTo = 0;
      break;
    case 'hr':
      insertMarkdown = '\n---\n';
      selectFrom = 0;
      selectTo = 0;
      break;
    case 'taskList':
      insertMarkdown = '- [ ] 任务项\n';
      selectFrom = 6;  // 选中 "任务项"
      selectTo = 9;
      break;
    case 'math':
      // 插入行内数学公式，光标放在公式内部
      insertMarkdown = '$公式$';
      selectFrom = 1;  // 选中 "公式"
      selectTo = 3;
      break;
    case 'footnote':
      insertMarkdown = '[^1]\n\n[^1]: 脚注内容\n';
      selectFrom = 0;
      selectTo = 0;
      break;
    case 'toc':
      // 插入 TOC 标记
      insertMarkdown = `\n${TOC_PLACEHOLDER}\n`;
      selectFrom = 0;
      selectTo = 0;
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

    // 如果有选区，设置选区
    if (selectFrom !== selectTo) {
      const insertEnd = from + doc.content.size;
      const contentStart = from;
      tr.setSelection(TextSelection.create(tr.doc, contentStart + selectFrom, contentStart + selectTo));
    }

    dispatch(tr);

    // 聚焦编辑器
    view.focus();
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

  editorRef.value.addEventListener('click', imageClickHandler);
  editorRef.value.addEventListener('contextmenu', imageContextMenuHandler);
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
  }
}

function undo(): void {
  if (!editor) return;
  try {
    const ctx = editor.ctx;
    const view = ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    undoCommand(state, dispatch);
  } catch (e) {
    console.error('Failed to undo:', e);
  }
}

function redo(): void {
  if (!editor) return;
  try {
    const ctx = editor.ctx;
    const view = ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    redoCommand(state, dispatch);
  } catch (e) {
    console.error('Failed to redo:', e);
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

defineExpose({
  applyFormat,
  insertNode,
  getContent,
  setContent,
  undo,
  redo,
  getCursorPosition,
  setCursorPosition,
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
  width: 100%;
  margin: 0.5em 0;
}

.milkdown-editor th,
.milkdown-editor td {
  border: 1px solid var(--vscode-editorWidget-border);
  padding: 12px 18px;
  text-align: left;
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
