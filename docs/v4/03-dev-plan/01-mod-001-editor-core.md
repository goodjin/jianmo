# 开发计划 - MOD-001: Editor Core

## 文档信息
- **模块编号**: MOD-001
- **模块名称**: Editor Core
- **所属层次**: L3 - 编辑器核心层
- **对应架构**: [03-mod-001-editor-core.md](../02-architecture/03-mod-001-editor-core.md)
- **优先级**: P0
- **预估工时**: 2天

---

## 1. 模块概述

### 1.1 模块职责

Editor Core 是编辑器的核心模块，负责：
- CodeMirror 6 编辑器实例管理
- 三种编辑模式切换（即时渲染/源码/分屏）
- 编辑器状态管理（内容、选区、历史）
- 快捷键绑定
- 撤销/重做功能

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-001 | 即时渲染模式 | US-001 |
| FR-002 | 源码编辑模式 | US-002 |
| FR-003 | 分屏预览模式 | US-003 |
| FR-014 | 快捷键 | US-001~003 |
| FR-016 | 撤销/重做 | US-008 |

### 1.3 架构定位

```
L7: App.vue
    ↓
L6: useEditor() Hook
    ↓
L3: Editor Core (本模块)
    ↓
L2: VS Code Integration
```

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useEditor.ts          # 核心 Hook
│   ├── useEditorState.ts     # 状态管理
│   └── __tests__/
│       └── useEditor.test.ts
├── core/
│   ├── editor.ts             # 编辑器创建
│   ├── extensions.ts         # 扩展配置
│   ├── commands.ts           # 编辑器命令
│   └── __tests__/
│       └── editor.test.ts
└── types/
    └── editor.ts             # 类型定义
```

### 2.2 依赖关系

| 依赖项 | 用途 |
|-------|------|
| @codemirror/state | EditorState, Transaction |
| @codemirror/view | EditorView, ViewPlugin |
| @codemirror/commands | 撤销/重做命令 |
| @codemirror/lang-markdown | Markdown 语言支持 |

---

## 3. 接口清单

| 任务编号 | 接口 | 名称 | 复杂度 |
|---------|------|------|-------|
| T-01 | - | 类型定义 | 低 |
| T-02 | API-001 | createEditor | 中 |
| T-03 | API-002 | switchMode | 中 |
| T-04 | API-003 | getContent | 低 |
| T-05 | API-004 | setContent | 低 |
| T-06 | API-041~043 | undo/redo/canUndo/canRedo | 低 |

---

## 4. 开发任务拆分

### 任务约束
- **代码变更**: ≤ 200行
- **涉及文件**: ≤ 5个
- **测试用例**: ≤ 10个

### 任务清单

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 类型定义 | 2 | ~80 | - |
| T-02 | 编辑器创建 | 3 | ~150 | T-01 |
| T-03 | 模式切换 | 3 | ~120 | T-02 |
| T-04 | 内容操作 | 2 | ~80 | T-02 |
| T-05 | 撤销重做 | 2 | ~60 | T-02 |
| T-06 | 单元测试 | 4 | ~200 | T-01~05 |

---

## 5. 详细任务定义

### T-01: 类型定义

**任务概述**: 定义编辑器核心类型

**对应架构**:
- 数据结构: DATA-001 EditorState
- 状态机: STATE-001 模式切换

**输出**:
- `webview/src/types/editor.ts`
- `webview/src/types/index.ts`

**实现要求**:

```typescript
// types/editor.ts
export type EditorMode = 'ir' | 'source' | 'split';

export interface EditorOptions {
  initialContent?: string;
  initialMode?: EditorMode;
  onChange?: (content: string) => void;
  onModeChange?: (mode: EditorMode) => void;
}

export interface EditorInstance {
  // 状态
  view: Ref<EditorView | null>;
  mode: Ref<EditorMode>;
  content: ComputedRef<string>;

  // 操作
  createEditor: (container: HTMLElement) => void;
  switchMode: (mode: EditorMode) => void;
  getContent: () => string;
  setContent: (content: string) => void;
  destroy: () => void;

  // 历史
  undo: () => void;
  redo: () => void;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
}
```

**验收标准**:
- [ ] 所有类型与架构规约一致
- [ ] 导出完整的类型定义

**测试要求**:
- 类型检查通过

**预估工时**: 0.5小时

---

### T-02: 编辑器创建

**任务概述**: 实现编辑器创建和基础配置

**对应架构**:
- 接口: API-001 createEditor
- 接口: API-007 destroy

**输出**:
- `webview/src/core/editor.ts`
- `webview/src/core/extensions.ts`
- `webview/src/composables/useEditor.ts` (基础部分)

**实现要求**:

```typescript
// core/extensions.ts
import { basicSetup } from 'codemirror';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';

export const createBaseExtensions = (mode: EditorMode): Extension[] => {
  const extensions: Extension[] = [
    basicSetup,
    markdown(),
  ];

  // 根据模式添加不同扩展
  switch (mode) {
    case 'ir':
      // 即时渲染模式：添加装饰器
      extensions.push(/* 装饰器扩展 */);
      break;
    case 'source':
      // 源码模式：语法高亮
      extensions.push(/* 语法高亮 */);
      break;
    case 'split':
      // 分屏模式：简化装饰
      extensions.push(/* 简化装饰器 */);
      break;
  }

  return extensions;
};

// core/editor.ts
export const createEditorState = (
  content: string,
  mode: EditorMode,
  extensions: Extension[] = []
): EditorState => {
  return EditorState.create({
    doc: content,
    extensions: [
      ...createBaseExtensions(mode),
      ...extensions,
    ],
  });
};

export const createEditorView = (
  container: HTMLElement,
  state: EditorState
): EditorView => {
  return new EditorView({
    state,
    parent: container,
  });
};
```

**验收标准**:
- [ ] 编辑器可正常创建
- [ ] 支持 Markdown 语法
- [ ] 可正确销毁

**测试要求**:
- 测试文件: `core/__tests__/editor.test.ts`
- 测试用例:
  1. 创建编辑器实例
  2. 设置初始内容
  3. 销毁编辑器

**预估工时**: 4小时

**依赖**: T-01

---

### T-03: 模式切换

**任务概述**: 实现三种编辑模式切换

**对应架构**:
- 接口: API-002 switchMode
- 状态机: STATE-001 模式切换

**输出**:
- `webview/src/composables/useEditor.ts` (模式切换部分)

**实现要求**:

```typescript
// composables/useEditor.ts
export const useEditor = (options: EditorOptions = {}): EditorInstance => {
  const view = ref<EditorView | null>(null);
  const mode = ref<EditorMode>(options.initialMode || 'ir');
  const containerRef = ref<HTMLElement | null>(null);

  // 创建编辑器
  const createEditor = (container: HTMLElement) => {
    containerRef.value = container;
    const state = createEditorState(
      options.initialContent || '',
      mode.value
    );
    view.value = createEditorView(container, state);
  };

  // 切换模式
  const switchMode = (newMode: EditorMode) => {
    if (!view.value || mode.value === newMode) return;

    const currentContent = view.value.state.doc.toString();

    // 创建新状态
    const newState = createEditorState(currentContent, newMode);

    // 更新视图
    view.value.setState(newState);
    mode.value = newMode;

    options.onModeChange?.(newMode);
  };

  // ... 其他方法

  return {
    view,
    mode,
    createEditor,
    switchMode,
    // ...
  };
};
```

**验收标准**:
- [ ] 三种模式可正常切换
- [ ] 切换时内容不丢失
- [ ] 切换时选区保持

**测试要求**:
- 测试文件: `composables/__tests__/useEditor.test.ts`
- 测试用例:
  1. 切换到源码模式
  2. 切换到即时渲染模式
  3. 切换到分屏模式
  4. 重复切换

**预估工时**: 3小时

**依赖**: T-02

---

### T-04: 内容操作

**任务概述**: 实现内容获取和设置

**对应架构**:
- 接口: API-003 getContent
- 接口: API-004 setContent

**输出**:
- `webview/src/composables/useEditor.ts` (内容操作部分)

**实现要求**:

```typescript
// composables/useEditor.ts
export const useEditor = (options: EditorOptions = {}): EditorInstance => {
  // ... 其他代码

  // 获取内容
  const getContent = (): string => {
    return view.value?.state.doc.toString() || '';
  };

  // 设置内容
  const setContent = (content: string) => {
    if (!view.value) return;

    const transaction = view.value.state.update({
      changes: {
        from: 0,
        to: view.value.state.doc.length,
        insert: content,
      },
    });

    view.value.dispatch(transaction);
  };

  // 计算属性
  const content = computed(() => getContent());

  // 监听变化
  onMounted(() => {
    if (!view.value) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange?.(getContent());
      }
    });

    // 添加监听器到编辑器
  });

  // ...

  return {
    // ...
    content,
    getContent,
    setContent,
    // ...
  };
};
```

**验收标准**:
- [ ] 可获取编辑器内容
- [ ] 可设置编辑器内容
- [ ] 内容变化时触发回调

**测试要求**:
- 测试用例:
  1. 获取内容
  2. 设置内容
  3. 内容变化回调

**预估工时**: 2小时

**依赖**: T-02

---

### T-05: 撤销重做

**任务概述**: 实现撤销/重做功能

**对应架构**:
- 接口: API-041 undo
- 接口: API-042 redo
- 接口: API-043 canUndo/canRedo

**输出**:
- `webview/src/composables/useEditor.ts` (撤销重做部分)
- `webview/src/core/commands.ts`

**实现要求**:

```typescript
// core/commands.ts
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';

export const createHistoryCommands = (view: EditorView) => ({
  undo: () => undo(view),
  redo: () => redo(view),
  canUndo: () => undoDepth(view.state) > 0,
  canRedo: () => redoDepth(view.state) > 0,
});

// composables/useEditor.ts
export const useEditor = (options: EditorOptions = {}): EditorInstance => {
  // ... 其他代码

  // 撤销
  const undo = () => {
    if (!view.value) return;
    const { undo: doUndo } = createHistoryCommands(view.value);
    doUndo();
  };

  // 重做
  const redo = () => {
    if (!view.value) return;
    const { redo: doRedo } = createHistoryCommands(view.value);
    doRedo();
  };

  // 计算属性
  const canUndo = computed(() => {
    if (!view.value) return false;
    return undoDepth(view.value.state) > 0;
  });

  const canRedo = computed(() => {
    if (!view.value) return false;
    return redoDepth(view.value.state) > 0;
  });

  // ...

  return {
    // ...
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
```

**验收标准**:
- [ ] 可撤销编辑操作
- [ ] 可重做编辑操作
- [ ] 正确报告可撤销/可重做状态

**测试要求**:
- 测试用例:
  1. 撤销操作
  2. 重做操作
  3. 检查 canUndo/canRedo

**预估工时**: 1.5小时

**依赖**: T-02

---

### T-06: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useEditor.test.ts`
- `webview/src/core/__tests__/editor.test.ts`

**实现要求**:

```typescript
// composables/__tests__/useEditor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditor } from '../useEditor';
import { mount } from '@vue/test-utils';

describe('useEditor', () => {
  it('should create editor', () => {
    const { createEditor, view } = useEditor();
    const container = document.createElement('div');

    createEditor(container);

    expect(view.value).not.toBeNull();
  });

  it('should switch modes', () => {
    const { createEditor, switchMode, mode } = useEditor();
    const container = document.createElement('div');

    createEditor(container);
    switchMode('source');

    expect(mode.value).toBe('source');
  });

  it('should get and set content', () => {
    const { createEditor, getContent, setContent } = useEditor();
    const container = document.createElement('div');

    createEditor(container);
    setContent('# Hello');

    expect(getContent()).toBe('# Hello');
  });

  it('should undo and redo', () => {
    const { createEditor, setContent, undo, redo, canUndo } = useEditor();
    const container = document.createElement('div');

    createEditor(container);
    setContent('First');
    setContent('Second');

    expect(canUndo.value).toBe(true);

    undo();
    expect(getContent()).toBe('First');

    redo();
    expect(getContent()).toBe('Second');
  });
});
```

**验收标准**:
- [ ] 测试覆盖率 ≥ 80%
- [ ] 所有测试通过

**预估工时**: 3小时

**依赖**: T-01~05

---

## 6. 验收清单

### 6.1 功能验收

- [ ] 编辑器可正常创建和销毁
- [ ] 三种模式可正常切换
- [ ] 内容获取和设置正常
- [ ] 撤销/重做功能正常

### 6.2 质量验收

- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 TypeScript 错误
- [ ] 代码符合规范

---

## 7. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-001 createEditor | T-02 | ✅ |
| API-002 switchMode | T-03 | ✅ |
| API-003 getContent | T-04 | ✅ |
| API-004 setContent | T-04 | ✅ |
| API-007 destroy | T-02 | ✅ |
| API-041 undo | T-05 | ✅ |
| API-042 redo | T-05 | ✅ |
| API-043 canUndo/canRedo | T-05 | ✅ |
| DATA-001 EditorState | T-01 | ✅ |
| STATE-001 模式切换 | T-03 | ✅ |
