# MOD-009: Find/Replace 查找替换模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-009
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
7. [边界条件](#边界条件)
8. [实现文件](#实现文件)
9. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L6 - 功能组件层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L7: App.vue (全局布局)                  │
│         管理查找面板显示/隐藏                         │
└─────────────────────┬───────────────────────────────┘
                      │ 传递 editor 实例
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-009: Find/Replace ★              │
│              查找替换模块                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  • FindPanel.vue      - 查找面板组件         │   │
│  │  • useFindReplace.ts  - 查找替换 Hook        │   │
│  │  • 正则表达式支持                            │   │
│  │  • 高亮所有匹配项                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ @codemirror/search
                      ▼
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              @codemirror/search 集成                 │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **文本查找**: 支持普通文本和正则表达式查找
- **文本替换**: 支持单个替换和全部替换
- **选项控制**: 区分大小写、全字匹配等选项
- **结果导航**: 上一个/下一个匹配项跳转
- **高亮显示**: 高亮所有匹配项

### 边界说明

- **负责**:
  - 查找面板 UI 渲染
  - 查找选项管理
  - 结果计数和导航
  - 匹配项高亮

- **不负责**:
  - 实际查找算法（@codemirror/search 负责）
  - 文档修改（L3 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-011 | 查找替换 |
| 用户故事 | US-009 | 查找与替换 |
| 验收标准 | AC-009-01~07 | 查找替换相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         查找替换模块架构位置                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   │  ┌─────────────────────────────────────────────────────────┐   │  │
│   │  │ FindPanel                                                 │   │  │
│   │  │  :visible="showFindPanel"                                 │   │  │
│   │  │  :editor="editorView"                                     │   │  │
│   │  │  @close="showFindPanel = false"                           │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ props / events                     │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-009: Find/Replace                                         │  │
│   │  components/FindPanel.vue                                       │  │
│   │  • 查找输入框                                                    │  │
│   │  • 替换输入框                                                    │  │
│   │  • 选项按钮（区分大小写等）                                       │  │
│   │  • 结果计数和导航按钮                                            │  │
│   │  composables/useFindReplace.ts                                  │  │
│   │  • openSearchPanel()                                            │  │
│   │  • findNext() / findPrevious()                                  │  │
│   │  • replace() / replaceAll()                                     │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ @codemirror/search                 │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ @codemirror/search                                               │  │
│   │  • SearchCursor                                                  │  │
│   │  • search()                                                      │  │
│   │  • replaceMatches()                                              │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Editor Core | MOD-001 | 执行查找命令 | props.editor |
| @codemirror/search | npm | 查找算法 | import |

---

## 核心设计

### 查找面板布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           查找面板布局                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔍 [查找内容..............] [3/12]  [↑] [↓]  [✕]               │   │
│  │     [替换为................]  [替换] [全部替换]                  │   │
│  │                                                                  │   │
│  │     [Aa] 区分大小写  [\b] 全字匹配  [.*] 正则表达式              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  组件说明:                                                              │
│  • 查找输入框: 支持输入查找文本，Enter 查找下一个                       │
│  • 替换输入框: 支持输入替换文本，可折叠                                │
│  • 结果计数: 显示 "当前匹配/总匹配数"                                   │
│  • 导航按钮: ↑ 上一个, ↓ 下一个                                        │
│  • 关闭按钮: ✕ 关闭面板                                                │
│  • 选项按钮: Aa 区分大小写, \b 全字匹配, .* 正则表达式                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### useFindReplace Hook

```typescript
// composables/useFindReplace.ts

import { ref, computed, watch } from 'vue';
import type { EditorView } from '@codemirror/view';
import { SearchCursor } from '@codemirror/search';

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface UseFindReplaceOptions {
  editorView: Ref<EditorView | null>;
}

export interface UseFindReplaceReturn {
  // 状态
  findText: Ref<string>;
  replaceText: Ref<string>;
  options: Ref<FindOptions>;
  isVisible: Ref<boolean>;

  // 结果
  currentMatch: ComputedRef<number>;
  totalMatches: ComputedRef<number>;
  hasMatches: ComputedRef<boolean>;

  // 操作
  openFindPanel: () => void;
  openReplacePanel: () => void;
  closePanel: () => void;
  findNext: () => void;
  findPrevious: () => void;
  replace: () => void;
  replaceAll: () => void;

  // 选项切换
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  toggleUseRegex: () => void;
}

export const useFindReplace = (options: UseFindReplaceOptions): UseFindReplaceReturn => {
  const { editorView } = options;

  // 状态
  const findText = ref('');
  const replaceText = ref('');
  const isVisible = ref(false);
  const options = ref<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });

  // 匹配结果缓存
  const matches = ref<{ from: number; to: number }[]>([]);
  const currentMatchIndex = ref(-1);

  // 计算匹配
  const computeMatches = () => {
    if (!editorView.value || !findText.value) {
      matches.value = [];
      currentMatchIndex.value = -1;
      return;
    }

    const newMatches: { from: number; to: number }[] = [];
    const cursor = new SearchCursor(
      editorView.value.state.doc,
      findText.value,
      0,
      { caseSensitive: options.value.caseSensitive }
    );

    while (!cursor.next().done) {
      const { from, to } = cursor.value;

      // 全字匹配检查
      if (options.value.wholeWord) {
        const text = editorView.value.state.doc.sliceString(from, to);
        const prevChar = from > 0
          ? editorView.value.state.doc.sliceString(from - 1, from)
          : '';
        const nextChar = to < editorView.value.state.doc.length
          ? editorView.value.state.doc.sliceString(to, to + 1)
          : '';

        const isWordChar = (c: string) => /\w/.test(c);
        if (isWordChar(prevChar) || isWordChar(nextChar)) {
          continue;
        }
      }

      newMatches.push({ from, to });
    }

    matches.value = newMatches;
    currentMatchIndex.value = newMatches.length > 0 ? 0 : -1;

    // 高亮匹配
    highlightMatches();
  };

  // 高亮匹配项
  const highlightMatches = () => {
    if (!editorView.value) return;

    // 使用装饰器高亮所有匹配
    // TODO: 实现高亮装饰
  };

  // 监听查找文本变化
  watch(findText, computeMatches);
  watch(options, computeMatches, { deep: true });

  // 计算属性
  const currentMatch = computed(() =>
    currentMatchIndex.value >= 0 ? currentMatchIndex.value + 1 : 0
  );
  const totalMatches = computed(() => matches.value.length);
  const hasMatches = computed(() => matches.value.length > 0);

  // 打开查找面板
  const openFindPanel = () => {
    isVisible.value = true;
    // 如果有选中文本，自动填入查找框
    if (editorView.value) {
      const selection = editorView.value.state.selection.main;
      if (!selection.empty) {
        findText.value = editorView.value.state.doc.sliceString(
          selection.from,
          selection.to
        );
      }
    }
  };

  // 打开替换面板
  const openReplacePanel = () => {
    openFindPanel();
    // 聚焦替换输入框
  };

  // 关闭面板
  const closePanel = () => {
    isVisible.value = false;
    findText.value = '';
    replaceText.value = '';
    matches.value = [];
  };

  // 查找下一个
  const findNext = () => {
    if (!hasMatches.value) return;

    currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.value.length;
    const match = matches.value[currentMatchIndex.value];

    editorView.value?.dispatch({
      selection: { anchor: match.from, head: match.to },
      scrollIntoView: true,
    });
  };

  // 查找上一个
  const findPrevious = () => {
    if (!hasMatches.value) return;

    currentMatchIndex.value =
      currentMatchIndex.value <= 0
        ? matches.value.length - 1
        : currentMatchIndex.value - 1;
    const match = matches.value[currentMatchIndex.value];

    editorView.value?.dispatch({
      selection: { anchor: match.from, head: match.to },
      scrollIntoView: true,
    });
  };

  // 替换当前匹配
  const replace = () => {
    if (!hasMatches.value || currentMatchIndex.value < 0) return;

    const match = matches.value[currentMatchIndex.value];

    editorView.value?.dispatch({
      changes: {
        from: match.from,
        to: match.to,
        insert: replaceText.value,
      },
    });

    // 重新计算匹配（因为文档已改变）
    computeMatches();

    // 跳到下一个匹配
    if (currentMatchIndex.value < matches.value.length) {
      findNext();
    }
  };

  // 替换所有匹配
  const replaceAll = () => {
    if (!hasMatches.value || !editorView.value) return;

    const changes = matches.value.map((match) => ({
      from: match.from,
      to: match.to,
      insert: replaceText.value,
    }));

    // 从后往前替换，避免位置偏移
    changes.sort((a, b) => b.from - a.from);

    editorView.value.dispatch({ changes });

    // 清除匹配
    matches.value = [];
    currentMatchIndex.value = -1;
  };

  // 选项切换
  const toggleCaseSensitive = () => {
    options.value.caseSensitive = !options.value.caseSensitive;
  };

  const toggleWholeWord = () => {
    options.value.wholeWord = !options.value.wholeWord;
  };

  const toggleUseRegex = () => {
    options.value.useRegex = !options.value.useRegex;
  };

  return {
    findText,
    replaceText,
    options,
    isVisible,
    currentMatch,
    totalMatches,
    hasMatches,
    openFindPanel,
    openReplacePanel,
    closePanel,
    findNext,
    findPrevious,
    replace,
    replaceAll,
    toggleCaseSensitive,
    toggleWholeWord,
    toggleUseRegex,
  };
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-029 | useFindReplace | Hook | composables/useFindReplace.ts | FR-011 |
| API-030 | FindPanel | Component | components/FindPanel.vue | FR-011 |
| API-031 | openSearchPanel | Method | useFindReplace.openFindPanel | FR-011 |

---

## 边界条件

### BOUND-038: 空查找文本

**边界描述**: 查找文本为空时，不显示匹配结果

**处理逻辑**:
```typescript
watch(findText, (newValue) => {
  if (!newValue.trim()) {
    matches.value = [];
    return;
  }
  computeMatches();
});
```

### BOUND-039: 正则表达式错误

**边界描述**: 启用正则表达式时，输入无效正则应显示错误提示

**处理逻辑**:
```typescript
const computeMatches = () => {
  if (options.value.useRegex) {
    try {
      new RegExp(findText.value);
    } catch (e) {
      // 显示错误提示
      errorMessage.value = '无效的正则表达式';
      return;
    }
  }
  // ...
};
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| components/FindPanel.vue | 查找面板组件 |
| composables/useFindReplace.ts | 查找替换逻辑 Hook |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-011 | useFindReplace, FindPanel | ✅ |
| 用户故事 | US-009 | API-029~031 | ✅ |
| 验收标准 | AC-009-01~07 | FindPanel.vue | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
