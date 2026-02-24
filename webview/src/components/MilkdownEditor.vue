<template>
  <div class="milkdown-editor" ref="editorRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { callCommand } from '@milkdown/utils';
import { toggleMark, wrapIn, setBlockType } from '@milkdown/prose/commands';
import { schema } from '@milkdown/preset-commonmark';
import type { ExtensionConfig } from '@types';

const props = defineProps<{
  content: string;
  config: ExtensionConfig;
}>();

const emit = defineEmits<{
  (e: 'change', content: string): void;
  (e: 'image-click', src: string, images: string[], index: number): void;
  (e: 'image-context-menu', src: string, x: number, y: number): void;
}>();

const editorRef = ref<HTMLElement | null>(null);
let editor: Editor | null = null;
let isInternalChange = false;
let lastEmittedContent = '';

onMounted(async () => {
  if (!editorRef.value) return;

  try {
    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.value);
        ctx.set(defaultValueCtx, props.content);

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          if (!isInternalChange) {
            lastEmittedContent = markdown;
            emit('change', markdown);
          }
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .create();

    // 绑定图片点击事件
    bindImageEvents();
  } catch (error) {
    console.error('Failed to create Milkdown editor:', error);
  }
});

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});

watch(
  () => props.content,
  (newContent) => {
    // 如果是刚刚发出的内容变更，忽略这次更新，避免光标跳动
    if (newContent === lastEmittedContent) {
      return;
    }
    if (editor && newContent !== getContent()) {
      isInternalChange = true;
      setContent(newContent);
      setTimeout(() => {
        isInternalChange = false;
      }, 100);
    }
  }
);

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

    // 内容不同，执行更新
    editorView.dispatch(
      state.tr.replaceWith(0, state.doc.content.size, newDoc.content)
    );
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
    case 'h1':
      command = setBlockType(nodes.heading!, { level: 1 });
      break;
    case 'h2':
      command = setBlockType(nodes.heading!, { level: 2 });
      break;
    case 'h3':
      command = setBlockType(nodes.heading!, { level: 3 });
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

function bindImageEvents(): void {
  if (!editorRef.value) return;

  editorRef.value.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const src = target.getAttribute('src') || '';
      const images = Array.from(editorRef.value?.querySelectorAll('img') || [])
        .map((img) => img.getAttribute('src') || '');
      const index = images.indexOf(src);
      emit('image-click', src, images, index);
    }
  });

  editorRef.value.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      const src = target.getAttribute('src') || '';
      emit('image-context-menu', src, e.clientX, e.clientY);
    }
  });
}

defineExpose({
  applyFormat,
  insertNode,
  getContent,
  setContent,
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
  font-family: v-bind('config.editor.fontFamily');
  font-size: v-bind('config.editor.fontSize * 1.5 + "px"');
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
</style>
