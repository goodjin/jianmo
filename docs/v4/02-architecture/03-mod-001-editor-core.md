# MOD-001: Editor Core 编辑器核心模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-001
- **版本**: v1.0
- **更新日期**: 2026-03-18
- **对应PRD**: docs/v4/01-prd.md

---

## 目录

1. [系统定位](#系统定位)
2. [对应PRD](#对应prd)
3. [全局架构位置](#全局架构位置)
4. [依赖关系](#依赖关系)
5. [数据流](#数据流)
6. [核心设计](#核心设计)
7. [接口定义](#接口定义)
8. [数据结构](#数据结构)
9. [状态机设计](#状态机设计)
10. [边界条件](#边界条件)
11. [非功能需求](#非功能需求)
12. [实现文件](#实现文件)
13. [验收标准](#验收标准)
14. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L3 - 编辑器核心层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L6: 功能组件层                          │
│         Toolbar.vue, OutlinePanel.vue               │
└─────────────────────┬───────────────────────────────┘
                      │ 调用 useEditor()
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-001: Editor Core ★               │
│              编辑器核心模块                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  • EditorState 管理                          │   │
│  │  • EditorView 实例                           │   │
│  │  • 模式切换 (IR/Source/Split)               │   │
│  │  • 快捷键映射                                │   │
│  │  • 撤销/重做                                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ 依赖
                      ▼
┌─────────────────────────────────────────────────────┐
│              L4: 语言支持层                          │
│         @codemirror/lang-markdown                  │
└─────────────────────┬───────────────────────────────┘
                      │ 依赖
                      ▼
┌─────────────────────────────────────────────────────┐
│              L5: 装饰渲染层                          │
│         headingDecorator, emphasisDecorator         │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **EditorState 管理**: 创建和维护 CodeMirror 6 编辑器状态
- **EditorView 实例**: 管理编辑器视图实例的生命周期
- **模式切换**: 支持 IR/Source/Split 三种模式的切换
- **快捷键映射**: 配置编辑器快捷键
- **撤销/重做**: 集成 CodeMirror 6 历史系统
- **内容同步**: 与 VS Code 进行内容同步

### 边界说明

- **负责**:
  - CodeMirror 6 实例的创建、更新、销毁
  - 编辑器模式的管理和切换
  - 基础编辑功能（输入、选择、删除等）
  - 编辑器级别的快捷键
  - 撤销/重做历史

- **不负责**:
  - Markdown 语法解析（由 L4 负责）
  - WYSIWYG 装饰渲染（由 L5 负责）
  - UI 组件渲染（由 L6/L7 负责）
  - VS Code 通信（由 L2 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-001 | 即时渲染模式 |
| 功能需求 | FR-002 | 源码编辑模式 |
| 功能需求 | FR-003 | 分屏预览模式 |
| 功能需求 | FR-014 | 快捷键 |
| 功能需求 | FR-016 | 撤销/重做 |
| 用户故事 | US-001 | 即时渲染编辑 |
| 用户故事 | US-002 | 源码模式编辑 |
| 用户故事 | US-003 | 分屏预览 |
| 用户故事 | US-008 | 撤销与重做 |
| 数据实体 | Entity-001 | EditorState |
| 业务流程 | Flow-001 | 模式切换 |
| 验收标准 | AC-001-01~05 | 即时渲染相关 |
| 验收标准 | AC-002-01~03 | 源码模式相关 |
| 验收标准 | AC-003-01~03 | 分屏预览相关 |
| 验收标准 | AC-008-01~05 | 撤销重做相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Markly v4 架构全景                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ useEditor()                       │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L6: Toolbar.vue, OutlinePanel.vue, FindPanel.vue                │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ props.editor                      │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-001: Editor Core (本模块) ★                               │  │
│   │  composables/useEditor.ts                                       │  │
│   │  • createState()                                                │  │
│   │  • switchMode()                                                 │  │
│   │  • getContent() / setContent()                                  │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ 依赖                              │
│       ┌────────────────────────────┼────────────────────────────┐     │
│       │                            │                            │     │
│       ▼                            ▼                            ▼     │
│   ┌─────────┐                ┌─────────┐                ┌─────────┐  │
│   │ L4:     │                │ L5:     │                │ @codemirror │
│   │ Markdown│                │Decorator│                │ /history   │
│   └─────────┘                └─────────┘                └─────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖（本模块调用的模块）

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Markdown Language | MOD-002 | Markdown 语言支持 | import { markdown } |
| Decorator System | MOD-003 | WYSIWYG 装饰器 | import { headingDecorator } |
| Theme System | MOD-010 | 主题样式 | import { getThemeExtension } |
| VS Code Integration | MOD-011 | 配置同步 | composables/useVSCode.ts |

### 下游依赖（调用本模块的模块）

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| Toolbar | MOD-007 | 工具栏操作编辑器 | props.editor |
| Outline Navigation | MOD-006 | 大纲跳转 | editorView.dispatch() |
| Find/Replace | MOD-009 | 查找替换 | @codemirror/search |
| App.vue | L7 | 全局编辑器管理 | useEditor() |

### 外部依赖

| 依赖项 | 类型 | 用途 | 版本要求 |
|-------|------|------|---------|
| @codemirror/state | npm | EditorState 管理 | ^6.0.0 |
| @codemirror/view | npm | EditorView 渲染 | ^6.0.0 |
| @codemirror/commands | npm | 基础命令（撤销/重做） | ^6.0.0 |
| @codemirror/search | npm | 查找替换 | ^6.0.0 |
| @codemirror/lang-markdown | npm | Markdown 语言 | ^6.0.0 |

---

## 数据流

### 输入数据流

| 数据项 | 来源 | 格式 | 说明 |
|-------|------|------|------|
| initialContent | VS Code Extension | string | 初始文档内容 |
| config.mode | VS Code Settings | 'ir' \| 'source' \| 'split' | 编辑模式 |
| config.theme | VS Code Settings | 'light' \| 'dark' \| 'auto' | 主题设置 |
| config.tabSize | VS Code Settings | number | 缩进空格数 |

### 输出数据流

| 数据项 | 目标 | 格式 | 说明 |
|-------|------|------|------|
| content | VS Code Extension | string | 变更后的文档内容 |
| selection | Toolbar, StatusBar | EditorSelection | 当前选区 |
| mode | App.vue | EditorMode | 当前模式 |

### 内部数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                     Editor Core 内部数据流                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Config    │────▶│ createState │────▶│ EditorState │      │
│   │   (配置)    │     │  (创建状态)  │     │  (编辑器状态) │      │
│   └─────────────┘     └─────────────┘     └──────┬──────┘      │
│                                                  │              │
│                                                  ▼              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   onChange  │◀────│   View      │◀────│ EditorView  │      │
│   │  (变更回调)  │     │ (视图更新)   │     │  (编辑器视图) │      │
│   └─────────────┘     └─────────────┘     └──────┬──────┘      │
│                                                  │              │
│                                                  ▼              │
│                                          ┌─────────────┐       │
│                                          │ Transaction │       │
│                                          │  (事务)      │       │
│                                          └─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心设计

### 设计目标

| 目标 | 描述 | 度量标准 |
|-----|------|---------|
| 状态可预测 | 所有状态转换都是纯函数 | 单元测试覆盖率 > 90% |
| 模式切换流畅 | 模式切换时间 < 200ms | 性能测试验证 |
| 内存可控 | 撤销历史限制 100 步 | 内存占用 < 200MB |
| 可测试 | 核心逻辑不依赖 DOM | 纯函数占比 > 80% |

### 核心组件

#### 1. useEditor Composable

```typescript
// composables/useEditor.ts

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { EditorState, Extension, Transaction } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { history, undo, redo } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';

// 类型定义
export type EditorMode = 'ir' | 'source' | 'split';

export interface EditorConfig {
  mode: EditorMode;
  theme: 'light' | 'dark' | 'auto';
  tabSize: number;
  lineWrapping: boolean;
}

export interface EditorOptions {
  initialContent: string;
  config: EditorConfig;
  parent: HTMLElement;
  onChange: (content: string) => void;
  onSelectionChange?: (selection: EditorSelection) => void;
}

export interface EditorInstance {
  view: EditorView;
  state: EditorState;
  mode: EditorMode;
  switchMode: (mode: EditorMode) => void;
  getContent: () => string;
  setContent: (content: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  destroy: () => void;
}

// 核心实现
export const useEditor = (options: EditorOptions): EditorInstance => {
  const { initialContent, config, parent, onChange, onSelectionChange } = options;

  // 响应式状态
  const mode = ref<EditorMode>(config.mode);
  const canUndo = ref(false);
  const canRedo = ref(false);

  // 编辑器视图引用
  let view: EditorView | null = null;

  // 创建编辑器扩展
  const createExtensions = (currentMode: EditorMode): Extension[] => {
    const extensions: Extension[] = [
      // 基础设置
      EditorView.lineWrapping,
      EditorState.tabSize.of(config.tabSize),

      // Markdown 语言支持
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // 历史记录（撤销/重做）
      history(),

      // 快捷键映射
      keymap.of([
        // 撤销/重做
        { key: 'Mod-z', run: undo, preventDefault: true },
        { key: 'Mod-Shift-z', run: redo, preventDefault: true },
        { key: 'Mod-y', run: redo, preventDefault: true },
        // 查找
        ...searchKeymap,
      ]),

      // 变更监听
      EditorView.updateListener.of((update: ViewUpdate) => {
        // 内容变更
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }

        // 选区变更
        if (update.selectionSet && onSelectionChange) {
          onSelectionChange(update.state.selection);
        }

        // 更新撤销/重做状态
        canUndo.value = undo({ state: update.state, dispatch: () => {} });
        canRedo.value = redo({ state: update.state, dispatch: () => {} });
      }),
    ];

    // 模式特定扩展
    extensions.push(...getModeExtensions(currentMode));

    // 主题扩展
    extensions.push(getThemeExtension(config.theme));

    return extensions;
  };

  // 获取模式特定扩展
  const getModeExtensions = (currentMode: EditorMode): Extension[] => {
    switch (currentMode) {
      case 'ir':
        return [
          // 即时渲染：启用所有装饰器
          headingDecorator(),
          emphasisDecorator(),
          linkDecorator(),
          codeDecorator(),
          taskListDecorator(),
        ];
      case 'source':
        return [
          // 源码模式：仅语法高亮，无装饰
          syntaxHighlighting(defaultHighlightStyle),
        ];
      case 'split':
        return [
          // 分屏模式：最小装饰
          syntaxHighlighting(defaultHighlightStyle),
        ];
      default:
        return [];
    }
  };

  // 创建编辑器状态
  const createState = (content: string, currentMode: EditorMode): EditorState => {
    return EditorState.create({
      doc: content,
      extensions: createExtensions(currentMode),
    });
  };

  // 初始化编辑器
  const initEditor = () => {
    const state = createState(initialContent, mode.value);

    view = new EditorView({
      state,
      parent,
    });

    // 初始化撤销/重做状态
    canUndo.value = undo({ state, dispatch: () => {} });
    canRedo.value = redo({ state, dispatch: () => {} });
  };

  // 切换模式
  const switchMode = (newMode: EditorMode) => {
    if (!view || newMode === mode.value) return;

    // 保存当前内容
    const currentContent = view.state.doc.toString();

    // 保存选区位置
    const selection = view.state.selection;

    // 创建新状态
    const newState = createState(currentContent, newMode);

    // 恢复选区（如果可能）
    try {
      view.setState(newState);
      // TODO: 恢复选区位置
    } catch {
      view.setState(newState);
    }

    mode.value = newMode;
  };

  // 获取内容
  const getContent = (): string => {
    return view?.state.doc.toString() ?? '';
  };

  // 设置内容
  const setContent = (content: string) => {
    if (!view) return;

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
  };

  // 撤销
  const handleUndo = (): boolean => {
    if (!view) return false;
    return undo(view);
  };

  // 重做
  const handleRedo = (): boolean => {
    if (!view) return false;
    return redo(view);
  };

  // 销毁
  const destroy = () => {
    view?.destroy();
    view = null;
  };

  // 初始化
  initEditor();

  return {
    get view() {
      if (!view) throw new Error('Editor not initialized');
      return view;
    },
    get state() {
      return view?.state;
    },
    mode: mode.value,
    switchMode,
    getContent,
    setContent,
    undo: handleUndo,
    redo: handleRedo,
    canUndo: canUndo.value,
    canRedo: canRedo.value,
    destroy,
  };
};
```

#### 2. 模式切换动画

```typescript
// composables/useModeTransition.ts

import { ref } from 'vue';

export const useModeTransition = () => {
  const isTransitioning = ref(false);

  const transition = async (
    from: EditorMode,
    to: EditorMode,
    callback: () => void
  ): Promise<void> => {
    isTransitioning.value = true;

    // 淡出动画
    await fadeOut(200);

    // 执行切换
    callback();

    // 淡入动画
    await fadeIn(200);

    isTransitioning.value = false;
  };

  const fadeOut = (duration: number): Promise<void> => {
    return new Promise((resolve) => {
      // CSS 动画处理
      setTimeout(resolve, duration);
    });
  };

  const fadeIn = (duration: number): Promise<void> => {
    return new Promise((resolve) => {
      // CSS 动画处理
      setTimeout(resolve, duration);
    });
  };

  return {
    isTransitioning,
    transition,
  };
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 方法 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-001 | createEditor | function | composables/useEditor.ts | FR-001 |
| API-002 | switchMode | method | EditorInstance.switchMode | FR-001~FR-003 |
| API-003 | getContent | method | EditorInstance.getContent | FR-001~FR-003 |
| API-004 | setContent | method | EditorInstance.setContent | FR-001~FR-003 |
| API-005 | undo | method | EditorInstance.undo | FR-016 |
| API-006 | redo | method | EditorInstance.redo | FR-016 |
| API-007 | destroy | method | EditorInstance.destroy | FR-001~FR-003 |

### 接口详细定义

#### API-001: createEditor

**对应PRD**:
- 用户故事: US-001, US-002, US-003
- 功能点: FR-001, FR-002, FR-003
- 验收标准: AC-001-01, AC-002-01, AC-003-01

**接口定义**:
- 路径: `composables/useEditor.ts`
- 描述: 创建编辑器实例

**请求参数**:
| 参数名 | 类型 | 必填 | 来源 | 说明 |
|-------|------|------|------|------|
| initialContent | string | 是 | VS Code | 初始文档内容 |
| config.mode | EditorMode | 是 | VS Code Settings | 编辑模式 |
| config.theme | string | 是 | VS Code Settings | 主题 |
| config.tabSize | number | 是 | VS Code Settings | 缩进空格数 |
| parent | HTMLElement | 是 | Vue ref | 编辑器挂载点 |
| onChange | function | 是 | 调用方 | 内容变更回调 |
| onSelectionChange | function | 否 | 调用方 | 选区变更回调 |

**响应格式**:
```typescript
interface EditorInstance {
  view: EditorView;
  state: EditorState;
  mode: EditorMode;
  switchMode: (mode: EditorMode) => void;
  getContent: () => string;
  setContent: (content: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  destroy: () => void;
}
```

**边界条件**:
| 编号 | 条件 | 处理方式 |
|-----|------|---------|
| BOUND-001 | parent 为 null | 抛出错误 "Editor container not found" |
| BOUND-002 | initialContent 过长 (>10MB) | 启用大文件模式，延迟加载 |

---

#### API-002: switchMode

**对应PRD**:
- 用户故事: US-001, US-002, US-003
- 功能点: FR-001, FR-002, FR-003
- 验收标准: AC-002-03, AC-003-01

**接口定义**:
- 路径: `EditorInstance.switchMode`
- 描述: 切换编辑器模式

**请求参数**:
| 参数名 | 类型 | 必填 | 来源 | 说明 |
|-------|------|------|------|------|
| mode | EditorMode | 是 | 用户操作 | 目标模式: 'ir' \| 'source' \| 'split' |

**边界条件**:
| 编号 | 条件 | 处理方式 |
|-----|------|---------|
| BOUND-003 | mode 相同 | 直接返回，无操作 |
| BOUND-004 | 切换中 | 忽略重复调用，等待完成 |

---

#### API-005: undo

**对应PRD**:
- 用户故事: US-008
- 功能点: FR-016
- 验收标准: AC-008-01

**接口定义**:
- 路径: `EditorInstance.undo`
- 描述: 撤销上一步操作

**响应**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| success | boolean | 是否成功撤销 |

**边界条件**:
| 编号 | 条件 | 处理方式 |
|-----|------|---------|
| BOUND-005 | 无历史记录 | 返回 false |
| BOUND-006 | 大操作（全选删除） | 不进入撤销栈（PRD 要求）|

---

## 数据结构

### 核心实体

#### DATA-001: EditorState

**对应PRD**: Entity-001

```typescript
interface EditorState {
  // CodeMirror 原生状态（不可变）
  doc: Text;                    // 文档内容
  selection: EditorSelection;   // 当前选区

  // 配置状态
  tabSize: number;              // 缩进空格数
  lineWrapping: boolean;        // 自动换行

  // 扩展状态
  history: HistoryState;        // 撤销/重做历史
}
```

**字段规约**:
| 字段名 | PRD属性 | 类型 | 约束 | 说明 |
|-------|---------|------|------|------|
| doc | - | Text | 必需 | CodeMirror Text 对象 |
| selection | - | EditorSelection | 必需 | 当前选区 |
| tabSize | Entity-001.tabSize | number | 默认 2 | 缩进空格数 |
| lineWrapping | Entity-001.lineWrapping | boolean | 默认 true | 自动换行 |

---

## 状态机设计

### STATE-001: Editor Mode State Machine

**对应PRD**: Flow-001

**状态定义**:
| 状态 | 编码 | PRD描述 | 说明 |
|-----|------|---------|------|
| IR_MODE | 'ir' | 即时渲染模式 | 显示 WYSIWYG 装饰 |
| SOURCE_MODE | 'source' | 源码模式 | 纯文本编辑 |
| SPLIT_MODE | 'split' | 分屏模式 | 编辑区 + 预览区 |

**状态转换**:
| 编号 | 当前状态 | 触发事件 | 下一状态 | 条件 | 对应PRD |
|-----|---------|---------|---------|------|---------|
| T001 | IR_MODE | switchMode('source') | SOURCE_MODE | 无 | FR-002 |
| T002 | IR_MODE | switchMode('split') | SPLIT_MODE | 无 | FR-003 |
| T003 | SOURCE_MODE | switchMode('ir') | IR_MODE | 无 | FR-001 |
| T004 | SOURCE_MODE | switchMode('split') | SPLIT_MODE | 无 | FR-003 |
| T005 | SPLIT_MODE | switchMode('ir') | IR_MODE | 无 | FR-001 |
| T006 | SPLIT_MODE | switchMode('source') | SOURCE_MODE | 无 | FR-002 |

**状态转换图**:
```
┌───────────┐      switchMode('source')      ┌─────────────┐
│  IR_MODE  │ ──────────────────────────────▶ │ SOURCE_MODE │
│  (FR-001) │ ◀────────────────────────────── │   (FR-002)  │
└─────┬─────┘      switchMode('ir')           └──────┬──────┘
      │                                              │
      │ switchMode('split')                          │ switchMode('split')
      │                                              │
      ▼                                              ▼
┌───────────┐      switchMode('ir')        ┌─────────────┐
│ SPLIT_MODE│ ◀──────────────────────────── │             │
│  (FR-003) │      switchMode('source')      │             │
└───────────┘ ─────────────────────────────▶ │             │
                                             └─────────────┘
```

---

## 边界条件

### BOUND-001: 编辑器容器不存在

**对应PRD**: AC-001-01

**输入边界**:
| 参数 | 类型 | 约束 | 来源 | 错误码 |
|-----|------|------|------|-------|
| parent | HTMLElement | 非 null | Vue ref | EDITOR_CONTAINER_NOT_FOUND |

**处理逻辑**:
```typescript
if (!parent) {
  throw new Error('EDITOR_CONTAINER_NOT_FOUND: Editor container element is required');
}
```

---

### BOUND-002: 大文件加载

**对应PRD**: 3.1 性能需求

**输入边界**:
| 参数 | 类型 | 约束 | 来源 | 说明 |
|-----|------|------|------|------|
| content | string | 长度 < 50MB | VS Code | 文档内容 |

**处理逻辑**:
```typescript
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

if (content.length > LARGE_FILE_THRESHOLD) {
  // 启用大文件模式
  config.largeFileMode = true;
  // 延迟加载装饰器
  config.lazyDecorators = true;
}
```

---

### BOUND-003: 重复模式切换

**对应PRD**: Flow-001

**业务边界**:
- 当前模式与目标模式相同，直接返回

**处理逻辑**:
```typescript
const switchMode = (newMode: EditorMode) => {
  if (newMode === mode.value) return; // 无操作
  // ... 切换逻辑
};
```

---

### BOUND-005: 无撤销历史

**对应PRD**: AC-008-01

**业务边界**:
- 撤销历史为空时，undo 操作返回 false

**处理逻辑**:
```typescript
const undo = (): boolean => {
  if (!view) return false;
  return undoCommand(view); // CodeMirror 内置命令会自动处理
};
```

---

## 非功能需求

### 性能要求

| 指标 | 要求 | 实现方案 |
|-----|------|---------|
| 初始化时间 | < 100ms | 延迟加载非核心扩展 |
| 模式切换 | < 200ms | 复用 DOM，仅切换扩展 |
| 内存占用 | < 200MB | 限制撤销历史 100 步 |
| 大文件支持 | 10MB+ | 虚拟滚动 + 增量解析 |

### 可测试性

```typescript
// 可测试的设计

// 1. 纯函数状态创建
export const createEditorState = (
  content: string,
  mode: EditorMode,
  config: EditorConfig
): EditorState => {
  // 纯函数，易于测试
  return EditorState.create({
    doc: content,
    extensions: createExtensions(mode, config),
  });
};

// 2. 依赖注入
export const createEditor = (
  options: EditorOptions,
  dependencies: EditorDependencies
): EditorInstance => {
  // 便于 Mock 测试
};

// 单元测试示例
describe('useEditor', () => {
  it('should create editor with initial content', () => {
    const editor = useEditor({
      initialContent: '# Hello',
      config: defaultConfig,
      parent: mockElement,
      onChange: vi.fn(),
    });

    expect(editor.getContent()).toBe('# Hello');
  });

  it('should switch mode correctly', () => {
    const editor = createTestEditor();
    editor.switchMode('source');
    expect(editor.mode).toBe('source');
  });
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| composables/useEditor.ts | 编辑器核心 Hook |
| composables/useModeTransition.ts | 模式切换动画 |
| shared/types.ts | 类型定义 |
| shared/constants.ts | 常量定义 |

---

## 验收标准

| 标准 | 要求 | 验证方法 | 对应PRD |
|-----|------|---------|---------|
| AC-001-01 | 输入 `# ` 后显示 H1 样式 | 视觉测试 | US-001 |
| AC-002-01 | 源码模式显示所有标记符 | 视觉测试 | US-002 |
| AC-002-03 | 支持快速切换模式 | 性能测试 < 200ms | US-002 |
| AC-008-01 | Ctrl+Z 撤销 | 功能测试 | US-008 |
| AC-008-03 | 撤销栈在模式切换后保持 | 功能测试 | US-008 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-001 | useEditor, createExtensions(ir) | ✅ |
| 功能需求 | FR-002 | useEditor, createExtensions(source) | ✅ |
| 功能需求 | FR-003 | useEditor, PreviewPanel | ✅ |
| 功能需求 | FR-014 | keymap.of([...]) | ✅ |
| 功能需求 | FR-016 | history(), undo(), redo() | ✅ |
| 用户故事 | US-001 | API-001, createExtensions(ir) | ✅ |
| 用户故事 | US-002 | API-002, createExtensions(source) | ✅ |
| 用户故事 | US-003 | API-002, createExtensions(split) | ✅ |
| 用户故事 | US-008 | API-005, API-006 | ✅ |
| 数据实体 | Entity-001 | DATA-001 | ✅ |
| 业务流程 | Flow-001 | STATE-001, API-002 | ✅ |
| 验收标准 | AC-001-01~05 | createExtensions(ir) | ✅ |
| 验收标准 | AC-002-01~03 | createExtensions(source) | ✅ |
| 验收标准 | AC-003-01~03 | switchMode('split') | ✅ |
| 验收标准 | AC-008-01~05 | undo(), redo() | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |

---

## 参考文档

- [整体架构设计](./01-overview.md)
- [分层架构设计](./02-layers.md)
- [PRD 文档](../01-prd.md)
