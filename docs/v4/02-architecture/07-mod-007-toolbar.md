# MOD-007: Toolbar 工具栏模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-007
- **版本**: v1.0
- **更新日期**: 2026-03-18
- **对应PRD**: docs/v4/01-prd.md

---

## 目录

1. [系统定位](#系统定位)
2. [对应PRD](#对应prd)
3. [全局架构位置](#全局架构位置)
4. [依赖关系](#依赖关系)
5. [核心设计](#核心设计)
6. [接口定义](#接口定义)
7. [数据结构](#数据结构)
8. [边界条件](#边界条件)
9. [实现文件](#实现文件)
10. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L6 - 功能组件层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L7: App.vue (全局布局)                  │
│         管理工具栏显示/隐藏状态                       │
└─────────────────────┬───────────────────────────────┘
                      │ 传递 editor 实例
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-007: Toolbar ★                   │
│              工具栏模块                              │
│  ┌─────────────────────────────────────────────┐   │
│  │  • Toolbar.vue        - 工具栏组件           │   │
│  │  • useToolbar.ts      - 工具栏逻辑 Hook      │   │
│  │  • 格式插入、快捷操作                         │   │
│  │  • 浮动工具栏 (选中文字)                      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ dispatch
                      ▼
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              执行实际的编辑器命令                    │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **格式操作**: 提供粗体、斜体、标题等格式快捷按钮
- **元素插入**: 支持插入链接、图片、表格、代码块等
- **浮动工具栏**: 选中文字时显示浮动格式工具栏
- **上下文感知**: 根据当前上下文禁用/启用按钮

### 边界说明

- **负责**:
  - 工具栏 UI 渲染
  - 按钮点击事件处理
  - 编辑器命令调用
  - 浮动工具栏定位

- **不负责**:
  - 实际文档修改（L3 负责）
  - Markdown 语法解析（L4 负责）
  - 图片上传保存（L2 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-009 | 工具栏 |
| 用户故事 | US-010 | 工具栏操作 |
| 验收标准 | AC-010-01~04 | 工具栏相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         工具栏模块架构位置                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   │  ┌─────────────────────────────────────────────────────────┐   │  │
│   │  │ Toolbar                                                   │   │  │
│   │  │  :editor="editorView"                                     │   │  │
│   │  │  @format="handleFormat"                                   │   │  │
│   │  │  @insert="handleInsert"                                   │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ props / events                     │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-007: Toolbar                                              │  │
│   │  components/Toolbar.vue                                         │  │
│   │  • 渲染工具栏按钮                                                │  │
│   │  • 处理点击事件                                                  │  │
│   │  • 调用编辑器命令                                                │  │
│   │  composables/useToolbar.ts                                      │  │
│   │  • toggleBold()                                                 │  │
│   │  • insertLink()                                                 │  │
│   │  • 检查选区状态                                                  │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ dispatch command                   │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L3: Editor Core                                                  │  │
│   │  • view.dispatch()                                               │  │
│   │  • 修改文档内容                                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Editor Core | MOD-001 | 执行编辑器命令 | props.editor |
| VS Code Integration | MOD-011 | 图片上传 | useVSCode() |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| App.vue | L7 | 全局工具栏 | <Toolbar /> |

---

## 核心设计

### 工具栏分组设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           工具栏布局                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐ │ ┌────┬────┬────┬────┬────┐ │ ┌────┬────┐ │ ┌────┬────┐ │
│  │ ↩ │ ↪ │ │ │ H1 │ B  │ I  │ S  │ `  │ │ │ 🔗 │ 🖼 │ │ │ •  │ ☑ │
│  │Undo Redo│ │ │Heading    Formatting   │ │ │Link Img│ │ │List Task│ │
│  └─────────┘ │ └────┴────┴────┴────┴────┘ │ └────┴────┘ │ └────┴────┘ │
│     Group 1  │          Group 2           │   Group 3   │   Group 4   │
│                                                                         │
│  ┌─────────┐ │ ┌────┬────┐                                               │
│  │ 𝑥       │ │ │ 📊 │ 📈 │                                               │
│  │Math     │ │ │Table Chart                                              │
│  └─────────┘ │ └────┴────┘                                               │
│     Group 5  │   Group 6                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 工具栏配置

```typescript
// shared/toolbarConfig.ts

export interface ToolbarButton {
  id: string;
  icon: string;
  title: string;
  shortcut?: string;
  action: () => void;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
}

export interface ToolbarGroup {
  id: string;
  buttons: ToolbarButton[];
}

export const toolbarConfig: ToolbarGroup[] = [
  {
    id: 'history',
    buttons: [
      { id: 'undo', icon: 'Undo', title: '撤销', shortcut: 'Ctrl+Z', action: undo },
      { id: 'redo', icon: 'Redo', title: '重做', shortcut: 'Ctrl+Shift+Z', action: redo },
    ],
  },
  {
    id: 'heading',
    buttons: [
      { id: 'h1', icon: 'H1', title: '标题 1', shortcut: 'Ctrl+1', action: () => toggleHeading(1) },
      { id: 'h2', icon: 'H2', title: '标题 2', shortcut: 'Ctrl+2', action: () => toggleHeading(2) },
      { id: 'h3', icon: 'H3', title: '标题 3', shortcut: 'Ctrl+3', action: () => toggleHeading(3) },
    ],
  },
  {
    id: 'formatting',
    buttons: [
      { id: 'bold', icon: 'Bold', title: '粗体', shortcut: 'Ctrl+B', action: toggleBold },
      { id: 'italic', icon: 'Italic', title: '斜体', shortcut: 'Ctrl+I', action: toggleItalic },
      { id: 'strikethrough', icon: 'Strikethrough', title: '删除线', action: toggleStrikethrough },
      { id: 'code', icon: 'Code', title: '行内代码', shortcut: 'Ctrl+`', action: toggleCode },
    ],
  },
  {
    id: 'insert',
    buttons: [
      { id: 'link', icon: 'Link', title: '链接', shortcut: 'Ctrl+K', action: insertLink },
      { id: 'image', icon: 'Image', title: '图片', action: insertImage },
      { id: 'table', icon: 'Table', title: '表格', action: insertTable },
    ],
  },
  {
    id: 'list',
    buttons: [
      { id: 'bullet', icon: 'List', title: '无序列表', action: toggleBulletList },
      { id: 'ordered', icon: 'ListOrdered', title: '有序列表', action: toggleOrderedList },
      { id: 'task', icon: 'CheckSquare', title: '任务列表', action: toggleTaskList },
    ],
  },
  {
    id: 'advanced',
    buttons: [
      { id: 'math', icon: 'Function', title: '数学公式', action: insertMath },
      { id: 'mermaid', icon: 'Diagram', title: '图表', action: insertMermaid },
      { id: 'codeBlock', icon: 'FileCode', title: '代码块', shortcut: 'Ctrl+Shift+K', action: insertCodeBlock },
    ],
  },
];
```

### useToolbar Hook

```typescript
// composables/useToolbar.ts

import { ref, computed } from 'vue';
import type { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export interface UseToolbarOptions {
  editorView: Ref<EditorView | null>;
}

export interface UseToolbarReturn {
  // 格式操作
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  toggleCode: () => void;
  toggleHeading: (level: number) => void;

  // 列表操作
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;

  // 插入操作
  insertLink: () => void;
  insertImage: () => void;
  insertTable: () => void;
  insertMath: () => void;
  insertMermaid: () => void;
  insertCodeBlock: () => void;

  // 历史操作
  undo: () => void;
  redo: () => void;

  // 状态检查
  isBold: ComputedRef<boolean>;
  isItalic: ComputedRef<boolean>;
  isCode: ComputedRef<boolean>;
  currentHeadingLevel: ComputedRef<number | null>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;

  // 选区信息
  hasSelection: ComputedRef<boolean>;
  selectedText: ComputedRef<string>;
}

export const useToolbar = (options: UseToolbarOptions): UseToolbarReturn => {
  const { editorView } = options;

  // 获取当前选区
  const selection = computed(() => {
    return editorView.value?.state.selection.main;
  });

  const hasSelection = computed(() => {
    return selection.value ? !selection.value.empty : false;
  });

  const selectedText = computed(() => {
    if (!editorView.value || !selection.value) return '';
    return editorView.value.state.doc.sliceString(
      selection.value.from,
      selection.value.to
    );
  });

  // 包裹选区文本
  const wrapSelection = (before: string, after: string = before) => {
    if (!editorView.value || !selection.value) return;

    const { from, to } = selection.value;
    const text = editorView.value.state.doc.sliceString(from, to);

    editorView.value.dispatch({
      changes: {
        from,
        to,
        insert: `${before}${text}${after}`,
      },
      selection: {
        anchor: from + before.length,
        head: from + before.length + text.length,
      },
    });
  };

  // 在光标处插入
  const insertAtCursor = (text: string) => {
    if (!editorView.value) return;

    const pos = editorView.value.state.selection.main.head;
    editorView.value.dispatch({
      changes: { from: pos, to: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
  };

  // 格式操作
  const toggleBold = () => wrapSelection('**');
  const toggleItalic = () => wrapSelection('*');
  const toggleStrikethrough = () => wrapSelection('~~');
  const toggleCode = () => wrapSelection('`');

  const toggleHeading = (level: number) => {
    if (!editorView.value) return;

    const line = editorView.value.state.doc.lineAt(
      editorView.value.state.selection.main.head
    );
    const text = line.text;
    const headingMark = '#'.repeat(level) + ' ';

    // 检查是否已经是标题
    const match = text.match(/^(#{1,6})\s*/);
    if (match) {
      // 替换标题级别
      const newText = text.replace(match[0], headingMark);
      editorView.value.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
      });
    } else {
      // 添加标题标记
      editorView.value.dispatch({
        changes: { from: line.from, to: line.from, insert: headingMark },
      });
    }
  };

  // 列表操作
  const toggleBulletList = () => {
    // 实现无序列表切换
  };

  const toggleOrderedList = () => {
    // 实现有序列表切换
  };

  const toggleTaskList = () => {
    // 实现任务列表切换
  };

  // 插入操作
  const insertLink = () => {
    if (hasSelection.value) {
      wrapSelection('[', '](url)');
    } else {
      insertAtCursor('[链接文本](url)');
    }
  };

  const insertImage = () => {
    insertAtCursor('![图片描述](图片路径)');
  };

  const insertTable = () => {
    const tableTemplate = `
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |
`;
    insertAtCursor(tableTemplate);
  };

  const insertMath = () => {
    if (hasSelection.value) {
      wrapSelection('$');
    } else {
      insertAtCursor('$公式$');
    }
  };

  const insertMermaid = () => {
    const mermaidTemplate = `
\`\`\`mermaid
graph TD
    A[开始] --> B[结束]
\`\`\`
`;
    insertAtCursor(mermaidTemplate);
  };

  const insertCodeBlock = () => {
    if (hasSelection.value) {
      wrapSelection('```\n', '\n```');
    } else {
      insertAtCursor('```\n代码块\n```');
    }
  };

  // 历史操作
  const undo = () => {
    import('@codemirror/commands').then(({ undo }) => {
      if (editorView.value) undo(editorView.value);
    });
  };

  const redo = () => {
    import('@codemirror/commands').then(({ redo }) => {
      if (editorView.value) redo(editorView.value);
    });
  };

  // 状态检查
  const isBold = computed(() => {
    // 检查选区是否在粗体内
    return false;
  });

  const isItalic = computed(() => false);
  const isCode = computed(() => false);
  const currentHeadingLevel = computed(() => null);
  const canUndo = computed(() => false);
  const canRedo = computed(() => false);

  return {
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleCode,
    toggleHeading,
    toggleBulletList,
    toggleOrderedList,
    toggleTaskList,
    insertLink,
    insertImage,
    insertTable,
    insertMath,
    insertMermaid,
    insertCodeBlock,
    undo,
    redo,
    isBold,
    isItalic,
    isCode,
    currentHeadingLevel,
    canUndo,
    canRedo,
    hasSelection,
    selectedText,
  };
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-023 | useToolbar | Hook | composables/useToolbar.ts | FR-009 |
| API-024 | Toolbar | Component | components/Toolbar.vue | FR-009 |
| API-025 | FloatingToolbar | Component | components/FloatingToolbar.vue | FR-009 |

---

## 数据结构

### ToolbarButton

```typescript
interface ToolbarButton {
  id: string;
  icon: string;
  title: string;
  shortcut?: string;
  action: () => void;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
}
```

---

## 边界条件

### BOUND-045: 无编辑器实例

**边界描述**: 编辑器未初始化时，工具栏按钮应禁用

**处理逻辑**:
```typescript
const isDisabled = computed(() => !editorView.value);
```

### BOUND-046: 代码块内禁用格式

**边界描述**: 光标在代码块内时，禁用格式按钮

**处理逻辑**:
```typescript
const isInCodeBlock = computed(() => {
  if (!editorView.value) return false;
  const pos = editorView.value.state.selection.main.head;
  const tree = syntaxTree(editorView.value.state);
  let inCodeBlock = false;
  tree.iterate({
    from: pos,
    to: pos,
    enter: (node) => {
      if (node.type.name === 'CodeBlock' || node.type.name === 'FencedCode') {
        inCodeBlock = true;
        return false;
      }
    },
  });
  return inCodeBlock;
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| components/Toolbar.vue | 工具栏组件 |
| components/FloatingToolbar.vue | 浮动工具栏组件 |
| composables/useToolbar.ts | 工具栏逻辑 Hook |
| shared/toolbarConfig.ts | 工具栏配置 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-009 | useToolbar, Toolbar | ✅ |
| 用户故事 | US-010 | API-023~025 | ✅ |
| 验收标准 | AC-010-01~04 | Toolbar.vue | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
