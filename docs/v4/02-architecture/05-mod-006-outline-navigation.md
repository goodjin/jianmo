# MOD-006: Outline Navigation 大纲导航模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-006
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
└─────────────────────┬───────────────────────────────┘
                      │ 调用
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-006: Outline Navigation ★        │
│              大纲导航模块                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  • OutlinePanel.vue   - 大纲面板组件         │   │
│  │  • useOutline.ts      - 大纲逻辑 Hook        │   │
│  │  • 标题提取与解析                            │   │
│  │  • 滚动同步与高亮                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ 依赖
                      ▼
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              获取文档内容、跳转位置                   │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **标题提取**: 从 Markdown 文档中提取 H1-H6 标题
- **大纲构建**: 构建树形结构的大纲
- **滚动同步**: 编辑器滚动时同步高亮当前章节
- **跳转导航**: 点击大纲项跳转到对应位置

### 边界说明

- **负责**:
  - 标题解析和树形结构构建
  - 大纲面板 UI 渲染
  - 当前章节高亮计算
  - 跳转位置计算

- **不负责**:
  - 文档编辑（L3 负责）
  - 标题样式渲染（L5 负责）
  - 滚动动画（浏览器原生）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-008 | 大纲导航 |
| 用户故事 | US-006 | 大纲导航 |
| 数据实体 | Entity-003 | HeadingNode |
| 验收标准 | AC-006-01~04 | 大纲导航相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         大纲导航模块架构位置                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   │  <OutlinePanel :headings="headings" @jump="handleJump" />        │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ props / events                     │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-006: Outline Navigation                                   │  │
│   │  components/OutlinePanel.vue                                    │  │
│   │  • 渲染大纲树                                                    │  │
│   │  • 处理点击跳转                                                  │  │
│   │  • 高亮当前章节                                                  │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ useOutline()                       │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  composables/useOutline.ts                                      │  │
│   │  • parseHeadings() - 解析标题                                   │  │
│   │  • buildTree() - 构建树形结构                                    │  │
│   │  • getCurrentHeading() - 获取当前章节                            │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ 依赖                              │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L3: Editor Core                                                  │  │
│   │  • view.state.doc.toString()                                    │  │
│   │  • view.dispatch({ selection:... })                             │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Editor Core | MOD-001 | 获取文档内容、执行跳转 | props.editor |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| App.vue | L7 | 全局大纲管理 | <OutlinePanel /> |

---

## 核心设计

### 大纲解析算法

```typescript
// 从 Markdown 文本中提取标题
const parseHeadings = (content: string): HeadingNode[] => {
  const headings: HeadingNode[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const charCount = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);

    // 匹配 ATX 标题: ## Title
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = atxMatch[2].trim();
      headings.push({
        level,
        text,
        from: charCount,
        to: charCount + line.length,
        line: i,
      });
      continue;
    }

    // 匹配 Setext 标题: Title\n=== 或 Title\n---
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1];
      if (/^=+$/.test(nextLine) && line.trim()) {
        headings.push({
          level: 1,
          text: line.trim(),
          from: charCount,
          to: charCount + line.length + 1 + nextLine.length,
          line: i,
        });
        i++; // 跳过下一行
        continue;
      }
      if (/^-+$/.test(nextLine) && line.trim()) {
        headings.push({
          level: 2,
          text: line.trim(),
          from: charCount,
          to: charCount + line.length + 1 + nextLine.length,
          line: i,
        });
        i++; // 跳过下一行
        continue;
      }
    }
  }

  return headings;
};
```

### 树形结构构建

```typescript
// 将扁平的标题列表转换为树形结构
const buildTree = (headings: HeadingNode[]): HeadingNode[] => {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const heading of headings) {
    const node: HeadingNode = { ...heading, children: [] };

    // 找到父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // 顶级节点
      root.push(node);
    } else {
      // 添加到父节点的 children
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push(node);
    }

    stack.push(node);
  }

  return root;
};
```

### 当前章节计算

```typescript
// 根据光标位置计算当前章节
const getCurrentHeading = (
  headings: HeadingNode[],
  cursorPosition: number
): HeadingNode | null => {
  let current: HeadingNode | null = null;

  for (const heading of headings) {
    if (heading.from <= cursorPosition) {
      current = heading;
    } else {
      break;
    }
  }

  return current;
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-020 | useOutline | Hook | composables/useOutline.ts | FR-008 |
| API-021 | OutlinePanel | Component | components/OutlinePanel.vue | FR-008 |
| API-022 | jumpToHeading | Method | useOutline.jumpToHeading | FR-008 |

### 接口详细定义

#### API-020: useOutline

**对应PRD**: US-006

**接口定义**:
```typescript
interface UseOutlineOptions {
  content: Ref<string>;
  editorView: Ref<EditorView | null>;
}

interface UseOutlineReturn {
  headings: ComputedRef<HeadingNode[]>;
  tree: ComputedRef<HeadingNode[]>;
  currentHeading: ComputedRef<HeadingNode | null>;
  jumpToHeading: (heading: HeadingNode) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export const useOutline = (options: UseOutlineOptions): UseOutlineReturn;
```

#### API-021: OutlinePanel

**对应PRD**: US-006, AC-006-01~04

**Props**:
| 属性名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| headings | HeadingNode[] | 是 | 大纲树数据 |
| currentHeading | HeadingNode \| null | 是 | 当前章节 |
| showLineNumbers | boolean | 否 | 是否显示行号 |

**Events**:
| 事件名 | 参数 | 说明 |
|-------|------|------|
| jump | HeadingNode | 点击大纲项时触发 |
| toggle | HeadingNode | 折叠/展开时触发 |

---

## 数据结构

### DATA-003: HeadingNode

**对应PRD**: Entity-003

```typescript
interface HeadingNode {
  // 标题级别 H1-H6
  level: 1 | 2 | 3 | 4 | 5 | 6;

  // 标题文本
  text: string;

  // 在文档中的起始位置
  from: number;

  // 在文档中的结束位置
  to: number;

  // 所在行号
  line: number;

  // 子标题（树形结构）
  children?: HeadingNode[];

  // 是否折叠（UI 状态）
  collapsed?: boolean;
}
```

**字段规约**:
| 字段名 | PRD属性 | 类型 | 约束 | 说明 |
|-------|---------|------|------|------|
| level | Entity-003.level | number | 1-6 | 标题级别 |
| text | Entity-003.text | string | 非空 | 标题文本 |
| from | Entity-003.from | number | ≥0 | 文档起始位置 |
| to | Entity-003.to | number | > from | 文档结束位置 |
| children | Entity-003.children | array | 可选 | 子标题列表 |

---

## 边界条件

### BOUND-019: 无标题文档

**对应PRD**: AC-006-01

**边界描述**:
- 文档中没有标题时，大纲面板显示空状态

**处理逻辑**:
```typescript
// OutlinePanel.vue
<template>
  <div class="outline-panel">
    <div v-if="headings.length === 0" class="outline-empty">
      暂无大纲
    </div>
    <tree-view v-else :data="tree" />
  </div>
</template>
```

### BOUND-020: 深层嵌套标题

**对应PRD**: AC-006-04

**边界描述**:
- 标题嵌套层级过深时的显示处理

**处理逻辑**:
```typescript
// 限制最大显示层级
const MAX_DISPLAY_LEVEL = 6;

// 超出层级的标题缩进处理
const getIndentStyle = (level: number): string => {
  const indent = Math.min(level, MAX_DISPLAY_LEVEL) * 16;
  return `padding-left: ${indent}px`;
};
```

### BOUND-021: 长标题文本

**对应PRD**: AC-006-04

**边界描述**:
- 标题文本过长时的显示处理

**处理逻辑**:
```css
.outline-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 悬浮提示显示完整标题 */
.outline-item:hover .tooltip {
  display: block;
}
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| composables/useOutline.ts | 大纲逻辑 Hook |
| components/OutlinePanel.vue | 大纲面板组件 |
| components/OutlineTree.vue | 大纲树组件（递归） |
| components/OutlineItem.vue | 大纲项组件 |

### 核心实现

```typescript
// composables/useOutline.ts
import { computed, ref, watch } from 'vue';
import type { EditorView } from '@codemirror/view';
import type { HeadingNode } from '../shared/types';

export interface UseOutlineOptions {
  content: Ref<string>;
  editorView: Ref<EditorView | null>;
}

export const useOutline = (options: UseOutlineOptions) => {
  const { content, editorView } = options;

  // 解析标题列表
  const headings = computed(() => parseHeadings(content.value));

  // 构建树形结构
  const tree = computed(() => buildTree(headings.value));

  // 当前章节
  const currentHeading = computed(() => {
    if (!editorView.value) return null;
    const cursorPos = editorView.value.state.selection.main.head;
    return getCurrentHeading(headings.value, cursorPos);
  });

  // 跳转到指定标题
  const jumpToHeading = (heading: HeadingNode) => {
    if (!editorView.value) return;

    const view = editorView.value;
    view.dispatch({
      selection: { anchor: heading.from },
      scrollIntoView: true,
    });
    view.focus();
  };

  // 展开/折叠状态
  const expandedKeys = ref<Set<string>>(new Set());

  const expandAll = () => {
    expandedKeys.value = new Set(headings.value.map(h => `${h.level}-${h.from}`));
  };

  const collapseAll = () => {
    expandedKeys.value.clear();
  };

  return {
    headings,
    tree,
    currentHeading,
    jumpToHeading,
    expandedKeys,
    expandAll,
    collapseAll,
  };
};
```

```vue
<!-- components/OutlinePanel.vue -->
<template>
  <div class="outline-panel" :class="{ 'is-visible': visible }">
    <div class="outline-header">
      <span class="outline-title">大纲</span>
      <div class="outline-actions">
        <button @click="expandAll" title="展开全部"><ExpandIcon /></button>
        <button @click="collapseAll" title="折叠全部"><CollapseIcon /></button>
      </div>
    </div>

    <div v-if="headings.length === 0" class="outline-empty">
      暂无大纲
    </div>

    <div v-else class="outline-content">
      <outline-tree
        :nodes="tree"
        :current-node="currentHeading"
        @select="handleSelect"
        @toggle="handleToggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HeadingNode } from '../shared/types';

interface Props {
  headings: HeadingNode[];
  currentHeading: HeadingNode | null;
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'jump', heading: HeadingNode): void;
}>();

const tree = computed(() => buildTree(props.headings));

const handleSelect = (node: HeadingNode) => {
  emit('jump', node);
};

const handleToggle = (node: HeadingNode) => {
  // 切换折叠状态
};

const expandAll = () => {
  // 展开所有节点
};

const collapseAll = () => {
  // 折叠所有节点
};
</script>

<style scoped>
.outline-panel {
  width: 250px;
  height: 100%;
  border-left: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.outline-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--vscode-sideBarTitle-foreground);
}

.outline-actions {
  display: flex;
  gap: 4px;
}

.outline-actions button {
  padding: 2px 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.7;
}

.outline-actions button:hover {
  opacity: 1;
}

.outline-empty {
  padding: 20px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.outline-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
</style>
```

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-008 | useOutline, OutlinePanel | ✅ |
| 用户故事 | US-006 | API-020~022 | ✅ |
| 数据实体 | Entity-003 | DATA-003 | ✅ |
| 验收标准 | AC-006-01 | parseHeadings | ✅ |
| 验收标准 | AC-006-02 | jumpToHeading | ✅ |
| 验收标准 | AC-006-03 | currentHeading | ✅ |
| 验收标准 | AC-006-04 | expandAll, collapseAll | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
