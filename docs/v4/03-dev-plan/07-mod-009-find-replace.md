# 开发计划 - MOD-009: Find/Replace

## 文档信息
- **模块编号**: MOD-009
- **模块名称**: Find/Replace
- **所属层次**: L6 - 功能组件层
- **对应架构**: [08-mod-009-find-replace.md](../02-architecture/08-mod-009-find-replace.md)
- **优先级**: P0
- **预估工时**: 1.5天

---

## 1. 模块概述

### 1.1 模块职责

Find/Replace 提供查找替换功能：
- 文本查找（普通/正则）
- 文本替换（单个/全部）
- 查找选项（大小写、全字匹配）
- 结果导航和高亮

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-011 | 查找替换 | US-009 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useFindReplace.ts     # 查找替换 Hook
│   └── __tests__/
│       └── useFindReplace.test.ts
└── components/
    └── FindPanel.vue         # 查找面板
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 类型定义 | 2 | ~60 | - |
| T-02 | useFindReplace Hook | 2 | ~200 | T-01 |
| T-03 | FindPanel 组件 | 2 | ~150 | T-02 |
| T-04 | 单元测试 | 2 | ~150 | T-01~03 |

---

## 4. 详细任务定义

### T-01: 类型定义

**任务概述**: 定义查找替换类型

**输出**:
- `webview/src/types/findReplace.ts`

**实现要求**:

```typescript
export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface MatchResult {
  from: number;
  to: number;
}
```

**预估工时**: 0.5小时

---

### T-02: useFindReplace Hook

**任务概述**: 实现查找替换 Hook

**输出**:
- `webview/src/composables/useFindReplace.ts`

**实现要求**:

```typescript
// composables/useFindReplace.ts
import { ref, computed, watch } from 'vue';
import type { EditorView } from '@codemirror/view';
import { SearchCursor } from '@codemirror/search';
import { FindOptions, MatchResult } from '../types/findReplace';

export interface UseFindReplaceOptions {
  editorView: Ref<EditorView | null>;
}

export const useFindReplace = (options: UseFindReplaceOptions) => {
  const { editorView } = options;

  const findText = ref('');
  const replaceText = ref('');
  const isVisible = ref(false);
  const options = ref<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });

  const matches = ref<MatchResult[]>([]);
  const currentMatchIndex = ref(-1);

  const currentMatch = computed(() =>
    currentMatchIndex.value >= 0 ? currentMatchIndex.value + 1 : 0
  );
  const totalMatches = computed(() => matches.value.length);
  const hasMatches = computed(() => matches.value.length > 0);

  // 计算匹配
  const computeMatches = () => {
    if (!editorView.value || !findText.value) {
      matches.value = [];
      return;
    }

    const newMatches: MatchResult[] = [];
    const cursor = new SearchCursor(
      editorView.value.state.doc,
      findText.value,
      0,
      { caseSensitive: options.value.caseSensitive }
    );

    while (!cursor.next().done) {
      const { from, to } = cursor.value;
      newMatches.push({ from, to });
    }

    matches.value = newMatches;
    currentMatchIndex.value = newMatches.length > 0 ? 0 : -1;
  };

  watch(findText, computeMatches);
  watch(options, computeMatches, { deep: true });

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

  // 替换
  const replace = () => {
    if (!hasMatches.value || currentMatchIndex.value < 0) return;
    const match = matches.value[currentMatchIndex.value];
    editorView.value?.dispatch({
      changes: { from: match.from, to: match.to, insert: replaceText.value },
    });
    computeMatches();
  };

  // 替换全部
  const replaceAll = () => {
    if (!hasMatches.value || !editorView.value) return;
    const changes = matches.value.map((match) => ({
      from: match.from,
      to: match.to,
      insert: replaceText.value,
    }));
    changes.sort((a, b) => b.from - a.from);
    editorView.value.dispatch({ changes });
    matches.value = [];
  };

  // 打开/关闭面板
  const openPanel = () => { isVisible.value = true; };
  const closePanel = () => { isVisible.value = false; };

  return {
    findText,
    replaceText,
    isVisible,
    options,
    currentMatch,
    totalMatches,
    hasMatches,
    findNext,
    findPrevious,
    replace,
    replaceAll,
    openPanel,
    closePanel,
  };
};
```

**预估工时**: 4小时

**依赖**: T-01

---

### T-03: FindPanel 组件

**任务概述**: 实现查找面板组件

**输出**:
- `webview/src/components/FindPanel.vue`

**预估工时**: 3小时

**依赖**: T-02

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useFindReplace.test.ts`

**预估工时**: 2小时

**依赖**: T-01~03

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-029 useFindReplace | T-02 | ✅ |
| API-030 FindPanel | T-03 | ✅ |
| API-031 openSearchPanel | T-02 | ✅ |
