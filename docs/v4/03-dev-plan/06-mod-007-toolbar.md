# 开发计划 - MOD-007: Toolbar

## 文档信息
- **模块编号**: MOD-007
- **模块名称**: Toolbar
- **所属层次**: L6 - 功能组件层
- **对应架构**: [07-mod-007-toolbar.md](../02-architecture/07-mod-007-toolbar.md)
- **优先级**: P0
- **预估工时**: 2天

---

## 1. 模块概述

### 1.1 模块职责

Toolbar 提供编辑器工具栏功能：
- 格式操作（粗体、斜体、删除线、代码）
- 标题插入
- 列表操作
- 链接和图片插入
- 代码块、表格、数学公式插入

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-009 | 工具栏 | US-010 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useToolbar.ts         # 工具栏 Hook
│   └── __tests__/
│       └── useToolbar.test.ts
├── components/
│   ├── Toolbar.vue           # 工具栏组件
│   └── ToolbarButton.vue     # 工具栏按钮
└── shared/
    └── toolbarConfig.ts      # 工具栏配置
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 工具栏配置 | 2 | ~150 | - |
| T-02 | useToolbar Hook | 2 | ~200 | T-01 |
| T-03 | Toolbar 组件 | 3 | ~150 | T-02 |
| T-04 | 单元测试 | 3 | ~150 | T-01~03 |

---

## 4. 详细任务定义

### T-01: 工具栏配置

**任务概述**: 定义工具栏按钮配置

**输出**:
- `webview/src/shared/toolbarConfig.ts`

**实现要求**:

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
```

**预估工时**: 2小时

---

### T-02: useToolbar Hook

**任务概述**: 实现工具栏操作 Hook

**输出**:
- `webview/src/composables/useToolbar.ts`

**实现要求**:

```typescript
// composables/useToolbar.ts
import { computed } from 'vue';
import type { EditorView } from '@codemirror/view';

export interface UseToolbarOptions {
  editorView: Ref<EditorView | null>;
}

export const useToolbar = (options: UseToolbarOptions) => {
  const { editorView } = options;

  const selection = computed(() => {
    return editorView.value?.state.selection.main;
  });

  const hasSelection = computed(() => {
    return selection.value ? !selection.value.empty : false;
  });

  // 包裹选区
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

  // 标题
  const toggleHeading = (level: number) => {
    if (!editorView.value) return;
    const line = editorView.value.state.doc.lineAt(
      editorView.value.state.selection.main.head
    );
    const marks = '#'.repeat(level) + ' ';
    editorView.value.dispatch({
      changes: { from: line.from, to: line.from, insert: marks },
    });
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

  const insertCodeBlock = () => {
    insertAtCursor('```\n代码块\n```');
  };

  return {
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleCode,
    toggleHeading,
    insertLink,
    insertImage,
    insertCodeBlock,
    hasSelection,
  };
};
```

**预估工时**: 4小时

**依赖**: T-01

---

### T-03: Toolbar 组件

**任务概述**: 实现工具栏组件

**输出**:
- `webview/src/components/Toolbar.vue`
- `webview/src/components/ToolbarButton.vue`

**预估工时**: 4小时

**依赖**: T-02

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useToolbar.test.ts`

**预估工时**: 2小时

**依赖**: T-01~03

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-023 useToolbar | T-02 | ✅ |
| API-024 Toolbar | T-03 | ✅ |
| API-025 FloatingToolbar | T-03 | ✅ |
