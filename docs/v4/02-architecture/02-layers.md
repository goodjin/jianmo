# 分层架构设计

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: ARCH-002
- **版本**: v1.0
- **对应PRD**: docs/v4/01-prd.md
- **更新日期**: 2026-03-18

---

## 1. 层次划分

| 层次 | 名称 | 职责 | 对应PRD功能 | 技术实现 |
|-----|------|------|------------|---------|
| L1 | 基础设施层 | 基础服务、工具函数 | 所有功能的底层支持 | utils/, constants/ |
| L2 | VS Code 集成层 | VS Code API 封装、通信 | FR-015 | extension/, composables/useVSCode.ts |
| L3 | 编辑器核心层 | CodeMirror 6 实例管理 | FR-001~FR-003, FR-016 | composables/useEditor.ts |
| L4 | 语言支持层 | Markdown 解析、语法高亮 | FR-004, FR-007 | extensions/markdown/ |
| L5 | 装饰渲染层 | WYSIWYG 装饰器 | FR-001, FR-005, FR-006 | extensions/decorators/ |
| L6 | 功能组件层 | 工具栏、大纲、查找等 | FR-008~FR-011 | components/ |
| L7 | 用户界面层 | 整体布局、主题 | FR-013 | App.vue, theme/ |

---

## 2. 层间依赖关系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           分层架构依赖图                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L7: 用户界面层 (UI Layer)                                        │   │
│  │  • App.vue, Layout 组件                                          │   │
│  │  • 主题样式、全局状态                                            │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L6: 功能组件层 (Feature Components)                              │   │
│  │  • Toolbar.vue, OutlinePanel.vue, FindPanel.vue                  │   │
│  │  • 业务组件、交互逻辑                                            │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L5: 装饰渲染层 (Decorator Layer)                                 │   │
│  │  • headingDecorator, emphasisDecorator, mathDecorator            │   │
│  │  • WYSIWYG 视觉效果实现                                          │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L4: 语言支持层 (Language Layer)                                  │   │
│  │  • @codemirror/lang-markdown                                     │   │
│  │  • GFM 支持、代码块高亮                                          │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L3: 编辑器核心层 (Editor Core)                                   │   │
│  │  • EditorState, EditorView                                       │   │
│  │  • 状态管理、事务处理                                            │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L2: VS Code 集成层 (VS Code Integration)                         │   │
│  │  • Custom Text Editor Provider                                   │   │
│  │  • Webview 通信、配置同步                                        │   │
│  └────────────────────┬────────────────────────────────────────────┘   │
│                       │ 依赖                                              │
│                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ L1: 基础设施层 (Infrastructure)                                  │   │
│  │  • 类型定义、常量、工具函数                                      │   │
│  │  • 纯函数、无副作用                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

依赖规则:
1. 上层可以依赖下层，下层不能依赖上层
2. 同层之间可以相互依赖
3. 禁止跨层依赖（如 L7 不能直接依赖 L3）
```

---

## 3. 功能-层次映射

### 3.1 P0 功能映射

| PRD功能 | 功能名称 | 所属层次 | 涉及模块 | 文件路径 |
|---------|---------|---------|---------|---------|
| FR-001 | 即时渲染模式 | L5 + L3 | MOD-003, MOD-001 | extensions/decorators/, composables/useEditor.ts |
| FR-002 | 源码编辑模式 | L3 | MOD-001 | composables/useEditor.ts |
| FR-003 | 分屏预览模式 | L6 + L3 | MOD-001 | components/PreviewPanel.vue |
| FR-004 | GFM 完整支持 | L4 | MOD-002 | extensions/markdown/gfm.ts |
| FR-005 | 数学公式支持 | L5 | MOD-004 | extensions/math/ |
| FR-007 | 代码块高亮 | L4 | MOD-002 | extensions/markdown/codeHighlight.ts |
| FR-008 | 大纲导航 | L6 | MOD-006 | components/OutlinePanel.vue |
| FR-014 | 快捷键 | L3 | MOD-001 | composables/useEditor.ts (keymap) |
| FR-016 | 撤销/重做 | L3 | MOD-001 | @codemirror/history |

### 3.2 P1 功能映射

| PRD功能 | 功能名称 | 所属层次 | 涉及模块 | 文件路径 |
|---------|---------|---------|---------|---------|
| FR-006 | 图表支持 | L5 | MOD-005 | extensions/diagram/mermaid.ts |
| FR-009 | 工具栏 | L6 | MOD-007 | components/Toolbar.vue |
| FR-010 | 图片处理 | L2 + L6 | MOD-008, MOD-011 | composables/useVSCode.ts, components/ImageUpload.vue |
| FR-011 | 查找替换 | L6 + L3 | MOD-009 | components/FindPanel.vue, @codemirror/search |
| FR-013 | 主题系统 | L7 | MOD-010 | extensions/theme/, App.vue |
| FR-015 | VS Code 配置同步 | L2 | MOD-011 | extension/configuration.ts |

---

## 4. 层次详细设计

### 4.1 L1: 基础设施层

**职责**: 提供基础类型、常量和纯函数工具

**核心文件**:
```typescript
// shared/types.ts - 类型定义
interface EditorConfig {
  mode: 'ir' | 'source' | 'split';
  theme: 'light' | 'dark' | 'auto';
  tabSize: number;
  lineWrapping: boolean;
  enableGFM: boolean;
  enableMath: boolean;
  enableDiagram: boolean;
  assetsPath: string;
}

interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  from: number;
  to: number;
  children?: HeadingNode[];
}

// shared/constants.ts - 常量
const CONSTANTS = {
  MAX_HISTORY_STEPS: 100,
  LARGE_FILE_THRESHOLD: 10 * 1024 * 1024, // 10MB
  IMAGE_SUPPORTED_FORMATS: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  DEBOUNCE_DELAY: 150,
};

// shared/utils.ts - 工具函数
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => { ... };

export const generateUniqueId = (): string => { ... };

export const isLargeFile = (content: string): boolean => { ... };
```

**设计原则**:
- 所有函数必须是纯函数
- 无副作用，不依赖外部状态
- 100% 单元测试覆盖

### 4.2 L2: VS Code 集成层

**职责**: 封装 VS Code API，提供与扩展主机的通信

**核心文件**:
```typescript
// composables/useVSCode.ts
export const useVSCode = () => {
  const vscode = acquireVsCodeApi();

  // 发送消息到 Extension Host
  const postMessage = (message: VSCodeMessage) => {
    vscode.postMessage(message);
  };

  // 监听来自 Extension Host 的消息
  const onMessage = (handler: (message: VSCodeMessage) => void) => {
    window.addEventListener('message', (e) => handler(e.data));
  };

  // 保存文件
  const saveFile = async (content: string) => {
    postMessage({ type: 'SAVE', payload: { content } });
  };

  // 上传图片
  const uploadImage = async (blob: Blob, filename: string) => {
    const base64 = await blobToBase64(blob);
    postMessage({ type: 'UPLOAD_IMAGE', payload: { base64, filename } });
  };

  return { postMessage, onMessage, saveFile, uploadImage };
};
```

**接口定义**:
```typescript
// 通信协议
interface VSCodeMessage {
  type: 'INIT' | 'UPDATE' | 'SAVE' | 'CONFIG_CHANGE' | 'IMAGE_UPLOAD' | 'IMAGE_SAVED';
  payload: unknown;
}

// Webview → Extension
interface WebviewToExtension {
  CONTENT_CHANGE: { content: string };
  SAVE_REQUEST: { content: string };
  IMAGE_UPLOAD: { base64: string; filename: string };
  CONFIG_UPDATE: { key: string; value: unknown };
}

// Extension → Webview
interface ExtensionToWebview {
  INIT_CONTENT: { content: string; config: EditorConfig };
  CONFIG_CHANGE: { config: Partial<EditorConfig> };
  IMAGE_SAVED: { path: string; url: string };
  THEME_CHANGE: { theme: 'light' | 'dark' };
}
```

### 4.3 L3: 编辑器核心层

**职责**: 管理 CodeMirror 6 实例，提供编辑器基础能力

**核心文件**:
```typescript
// composables/useEditor.ts
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { history } from '@codemirror/commands';

export const useEditor = (options: EditorOptions) => {
  const { initialContent, config, onChange } = options;

  // 创建编辑器状态
  const createState = (content: string, mode: EditorMode): EditorState => {
    const extensions: Extension[] = [
      // 基础扩展
      history(),

      // Markdown 语言支持
      markdown({ base: markdownLanguage }),

      // 模式特定扩展
      ...getModeExtensions(mode),

      // 主题
      getThemeExtension(config.theme),

      // 变更监听
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    return EditorState.create({
      doc: content,
      extensions,
    });
  };

  // 获取模式特定扩展
  const getModeExtensions = (mode: EditorMode): Extension[] => {
    switch (mode) {
      case 'ir':
        return [
          // 即时渲染：启用装饰器
          headingDecorator(),
          emphasisDecorator(),
          linkDecorator(),
          // ... 其他装饰器
        ];
      case 'source':
        return [
          // 源码模式：仅语法高亮，无装饰
        ];
      case 'split':
        return [
          // 分屏模式：最小装饰
          headingDecorator({ minimal: true }),
        ];
      default:
        return [];
    }
  };

  // 创建编辑器视图
  const view = new EditorView({
    state: createState(initialContent, config.mode),
    parent: options.parent,
  });

  // 切换模式
  const switchMode = (newMode: EditorMode) => {
    const currentContent = view.state.doc.toString();
    const newState = createState(currentContent, newMode);
    view.setState(newState);
  };

  // 获取内容
  const getContent = (): string => view.state.doc.toString();

  // 设置内容
  const setContent = (content: string) => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
  };

  // 销毁
  const destroy = () => view.destroy();

  return {
    view,
    switchMode,
    getContent,
    setContent,
    destroy,
  };
};
```

### 4.4 L4: 语言支持层

**职责**: Markdown 语言解析、GFM 支持、代码块高亮

**核心文件**:
```typescript
// extensions/markdown/base.ts
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

export const createMarkdownExtension = () => {
  return markdown({
    base: markdownLanguage,
    codeLanguages: languages,  // 代码块语言高亮
    completeHTMLTags: false,
  });
};

// extensions/markdown/gfm.ts
import { markdownLanguage } from '@codemirror/lang-markdown';

export const gfmExtension = markdown({
  base: markdownLanguage,  // 包含 GFM：表格、任务列表、删除线、自动链接
});

// extensions/markdown/codeHighlight.ts
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6a9955' },
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.function(tags.variableName), color: '#dcdcaa' },
]);

export const codeHighlightExtension = syntaxHighlighting(codeHighlightStyle);
```

### 4.5 L5: 装饰渲染层

**职责**: 实现 WYSIWYG 视觉效果

**核心文件**:
```typescript
// extensions/decorators/heading.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export const headingDecorator = (options: { minimal?: boolean } = {}) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView): DecorationSet {
      const decorations: Range<Decoration>[] = [];
      const tree = syntaxTree(view.state);

      tree.iterate({
        enter: (node) => {
          if (node.type.name === 'ATXHeading1') {
            // H1: 添加样式装饰
            const deco = Decoration.mark({
              class: 'cm-heading cm-heading-1',
              attributes: { style: 'font-size: 1.4em; font-weight: 700;' },
            });
            decorations.push(deco.range(node.from, node.to));
          }
          // ... H2~H6 类似
        },
      });

      return Decoration.set(decorations);
    }
  }, {
    decorations: (v) => v.decorations,
  });
};

// extensions/decorators/emphasis.ts
export const emphasisDecorator = () => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView): DecorationSet {
      const decorations: Range<Decoration>[] = [];
      const tree = syntaxTree(view.state);

      tree.iterate({
        enter: (node) => {
          if (node.type.name === 'StrongEmphasis') {
            const deco = Decoration.mark({
              class: 'cm-strong',
              attributes: { style: 'font-weight: 700;' },
            });
            decorations.push(deco.range(node.from, node.to));
          }
          if (node.type.name === 'Emphasis') {
            const deco = Decoration.mark({
              class: 'cm-emphasis',
              attributes: { style: 'font-style: italic;' },
            });
            decorations.push(deco.range(node.from, node.to));
          }
        },
      });

      return Decoration.set(decorations);
    }
  }, {
    decorations: (v) => v.decorations,
  });
};
```

### 4.6 L6: 功能组件层

**职责**: 业务组件实现

**核心文件**:
```vue
<!-- components/Toolbar.vue -->
<template>
  <div class="toolbar" v-show="visible">
    <div class="toolbar-group">
      <button @click="undo" :disabled="!canUndo" title="撤销 (Ctrl+Z)">
        <UndoIcon />
      </button>
      <button @click="redo" :disabled="!canRedo" title="重做 (Ctrl+Shift+Z)">
        <RedoIcon />
      </button>
    </div>
    <div class="toolbar-divider" />
    <div class="toolbar-group">
      <button @click="toggleHeading(1)" title="标题 1">H1</button>
      <button @click="toggleHeading(2)" title="标题 2">H2</button>
      <button @click="toggleBold" title="粗体 (Ctrl+B)"><BoldIcon /></button>
      <button @click="toggleItalic" title="斜体 (Ctrl+I)"><ItalicIcon /></button>
    </div>
    <!-- ... 更多工具栏按钮 -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from '../composables/useEditor';

const props = defineProps<{
  editor: EditorView;
}>();

const { canUndo, canRedo, toggleHeading, toggleBold, toggleItalic } = useToolbar(props.editor);

const visible = computed(() => editorStore.showToolbar);
</script>
```

### 4.7 L7: 用户界面层

**职责**: 整体布局、主题、全局状态

**核心文件**:
```vue
<!-- App.vue -->
<template>
  <div class="markly-editor" :class="[`theme-${theme}`, `mode-${mode}`]">
    <Toolbar
      v-show="showToolbar"
      :editor="editorView"
      @format="handleFormat"
      @insert="handleInsert"
    />

    <div class="editor-main">
      <div class="editor-container" ref="editorContainer">
        <!-- CodeMirror 编辑器挂载点 -->
      </div>

      <PreviewPanel
        v-if="mode === 'split'"
        :content="content"
        :scroll-position="scrollPosition"
        @scroll="handlePreviewScroll"
      />

      <OutlinePanel
        v-show="showOutline"
        :headings="headings"
        :current-heading="currentHeading"
        @jump="handleOutlineJump"
      />
    </div>

    <FindPanel
      v-if="showFindPanel"
      :editor="editorView"
      @close="showFindPanel = false"
    />

    <StatusBar
      :word-count="wordCount"
      :char-count="charCount"
      :mode="mode"
      @switch-mode="switchMode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useEditor } from './composables/useEditor';
import { useVSCode } from './composables/useVSCode';
import { useTheme } from './composables/useTheme';
import { useOutline } from './composables/useOutline';

// 状态
const mode = ref<'ir' | 'source' | 'split'>('ir');
const showToolbar = ref(true);
const showOutline = ref(true);
const showFindPanel = ref(false);
const content = ref('');

// Composables
const { theme } = useTheme();
const { editorView, createEditor, switchMode } = useEditor({
  onChange: (newContent) => {
    content.value = newContent;
  },
});
const { headings, currentHeading } = useOutline(content);
const vscode = useVSCode();

// 生命周期
onMounted(() => {
  createEditor(editorContainer.value);

  // 监听 VS Code 消息
  vscode.onMessage((message) => {
    switch (message.type) {
      case 'INIT_CONTENT':
        content.value = message.payload.content;
        break;
      case 'CONFIG_CHANGE':
        // 更新配置
        break;
    }
  });
});

onUnmounted(() => {
  editorView.value?.destroy();
});
</script>
```

---

## 5. 层间通信规范

### 5.1 通信规则

| 通信方向 | 方式 | 示例 |
|---------|------|------|
| L7 → L6 | Props + Events | `<Toolbar :editor="view" @format="handleFormat" />` |
| L6 → L5 | 编辑器命令 | `view.dispatch({ effects: toggleBold })` |
| L5 → L4 | 扩展组合 | `extensions: [markdown(), headingDecorator()]` |
| L4 → L3 | 状态创建 | `EditorState.create({ extensions })` |
| L3 → L2 | Composable 调用 | `useVSCode().saveFile(content)` |
| L2 → L1 | 工具函数 | `generateUniqueId()` |

### 5.2 禁止的跨层调用

```typescript
// ❌ 错误：L7 直接调用 L3
// App.vue
const view = new EditorView({ ... });  // 不应该直接创建

// ✅ 正确：通过 L6 封装
// App.vue
const { view } = useEditor();  // 使用封装后的 Hook

// ❌ 错误：L5 直接调用 L2
// headingDecorator.ts
vscode.postMessage({ ... });  // 装饰器不应该知道 VS Code

// ✅ 正确：通过事件传递
// headingDecorator.ts 触发事件
// L3 监听事件并调用 L2
```

---

## 6. 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本，定义七层架构 | AI |

---

## 参考文档

- [整体架构设计](./01-overview.md)
- [模块详细设计](./03-*.md)
