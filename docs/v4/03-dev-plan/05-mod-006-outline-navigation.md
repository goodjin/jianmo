# 开发计划 - MOD-006: Outline Navigation

## 文档信息
- **模块编号**: MOD-006
- **模块名称**: Outline Navigation
- **所属层次**: L6 - 功能组件层
- **对应架构**: [05-mod-006-outline-navigation.md](../02-architecture/05-mod-006-outline-navigation.md)
- **优先级**: P0
- **预估工时**: 1.5天

---

## 1. 模块概述

### 1.1 模块职责

Outline Navigation 负责大纲导航功能：
- 标题提取和解析
- 树形结构构建
- 当前章节高亮
- 跳转导航

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-008 | 大纲导航 | US-006 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useOutline.ts         # 大纲 Hook
│   └── __tests__/
│       └── useOutline.test.ts
├── components/
│   ├── OutlinePanel.vue      # 大纲面板
│   ├── OutlineTree.vue       # 大纲树
│   └── OutlineItem.vue       # 大纲项
└── shared/
    └── outline.ts            # 大纲工具
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 类型定义 | 2 | ~60 | - |
| T-02 | 标题解析 | 2 | ~100 | T-01 |
| T-03 | useOutline Hook | 2 | ~120 | T-02 |
| T-04 | 大纲组件 | 4 | ~200 | T-03 |
| T-05 | 单元测试 | 3 | ~150 | T-01~04 |

---

## 4. 详细任务定义

### T-01: 类型定义

**任务概述**: 定义大纲相关类型

**输出**:
- `webview/src/shared/types.ts`

**实现要求**:

```typescript
export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  from: number;
  to: number;
  line: number;
  children?: HeadingNode[];
  collapsed?: boolean;
}
```

**预估工时**: 0.5小时

---

### T-02: 标题解析

**任务概述**: 实现标题解析算法

**输出**:
- `webview/src/shared/outline.ts`

**实现要求**:

```typescript
// shared/outline.ts
import { HeadingNode } from './types';

export const parseHeadings = (content: string): HeadingNode[] => {
  const headings: HeadingNode[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const charCount = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);

    // ATX 标题: ## Title
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = parseInt(atxMatch[1].length.toString(), 10) as 1 | 2 | 3 | 4 | 5 | 6;
      headings.push({
        level,
        text: atxMatch[2].trim(),
        from: charCount,
        to: charCount + line.length,
        line: i,
      });
    }
  }

  return headings;
};

export const buildTree = (headings: HeadingNode[]): HeadingNode[] => {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const heading of headings) {
    const node: HeadingNode = { ...heading, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push(node);
    }

    stack.push(node);
  }

  return root;
};
```

**预估工时**: 2小时

**依赖**: T-01

---

### T-03: useOutline Hook

**任务概述**: 实现大纲管理 Hook

**输出**:
- `webview/src/composables/useOutline.ts`

**实现要求**:

```typescript
// composables/useOutline.ts
import { computed, ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { parseHeadings, buildTree } from '../shared/outline';
import { HeadingNode } from '../shared/types';

export interface UseOutlineOptions {
  content: Ref<string>;
  editorView: Ref<EditorView | null>;
}

export const useOutline = (options: UseOutlineOptions) => {
  const { content, editorView } = options;

  const headings = computed(() => parseHeadings(content.value));
  const tree = computed(() => buildTree(headings.value));

  const currentHeading = computed(() => {
    if (!editorView.value) return null;
    const cursorPos = editorView.value.state.selection.main.head;

    let current: HeadingNode | null = null;
    for (const heading of headings.value) {
      if (heading.from <= cursorPos) {
        current = heading;
      } else {
        break;
      }
    }
    return current;
  });

  const jumpToHeading = (heading: HeadingNode) => {
    if (!editorView.value) return;
    editorView.value.dispatch({
      selection: { anchor: heading.from },
      scrollIntoView: true,
    });
    editorView.value.focus();
  };

  return {
    headings,
    tree,
    currentHeading,
    jumpToHeading,
  };
};
```

**预估工时**: 2小时

**依赖**: T-02

---

### T-04: 大纲组件

**任务概述**: 实现大纲面板组件

**输出**:
- `webview/src/components/OutlinePanel.vue`
- `webview/src/components/OutlineTree.vue`
- `webview/src/components/OutlineItem.vue`

**预估工时**: 4小时

**依赖**: T-03

---

### T-05: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useOutline.test.ts`
- `webview/src/shared/__tests__/outline.test.ts`

**预估工时**: 2小时

**依赖**: T-01~04

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-020 useOutline | T-03 | ✅ |
| API-021 OutlinePanel | T-04 | ✅ |
| API-022 jumpToHeading | T-03 | ✅ |
| DATA-003 HeadingNode | T-01 | ✅ |
