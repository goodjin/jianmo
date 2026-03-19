# MOD-004: Math Support 数学公式支持模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-004
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

**所属层次**: L5 - 渲染装饰层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L6: Toolbar (工具栏)                    │
│         插入数学公式按钮                              │
└─────────────────────┬───────────────────────────────┘
                      │ 调用
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-004: Math Support ★              │
│              数学公式支持模块                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  • mathDecorator.ts   - 数学装饰器           │   │
│  │  • MathRenderer.vue   - 公式渲染组件         │   │
│  │  • KaTeX 集成                                │   │
│  │  • 行内/块级公式支持                          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ Decoration
                      ▼
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              应用数学装饰器到编辑器                    │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **语法解析**: 识别 Markdown 中的数学公式语法（$...$ 和 $$...$$）
- **公式渲染**: 使用 KaTeX 将 LaTeX 公式渲染为 HTML
- **实时预览**: 即时渲染输入的数学公式
- **错误处理**: 处理公式语法错误，友好提示

### 边界说明

- **负责**:
  - 数学公式语法识别
  - LaTeX 公式渲染
  - 渲染错误处理
  - 公式样式定制

- **不负责**:
  - 公式编辑器 UI（L6 负责）
  - 公式输入辅助（如符号面板）
  - 复杂数学计算

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-005 | 数学公式支持 |
| 用户故事 | US-005 | 数学公式 |
| 验收标准 | AC-005-01~04 | 数学公式相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         数学公式模块架构位置                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L6: Toolbar                                                      │  │
│   │  insertMath() → 插入 $...$ 或 $$...$$                            │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                  │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-004: Math Support                                         │  │
│   │  decorators/mathDecorator.ts                                    │  │
│   │  • 识别 $inline$ 和 $$block$$ 语法                               │  │
│   │  • 创建 Widget Decoration                                        │  │
│   │  • 调用 KaTeX 渲染                                               │  │
│   │  components/MathRenderer.vue                                    │  │
│   │  • 封装 KaTeX 渲染逻辑                                           │  │
│   │  • 错误边界处理                                                  │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Decoration.widget()              │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L3: Editor Core                                                  │  │
│   │  • EditorView 显示渲染后的公式                                    │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Editor Core | MOD-001 | 应用装饰器 | Extension |
| KaTeX | npm | 公式渲染 | import |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| Decorator System | MOD-003 | 数学装饰器注册 | mathDecorator |
| Toolbar | MOD-007 | 插入公式 | insertMath |

---

## 核心设计

### 数学公式语法

```markdown
行内公式: $E = mc^2$

块级公式:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### 装饰器实现

```typescript
// decorators/mathDecorator.ts

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import katex from 'katex';

export interface MathDecoratorOptions {
  enableInline?: boolean;   // 启用行内公式，默认 true
  enableBlock?: boolean;    // 启用块级公式，默认 true
  throwOnError?: boolean;   // 错误时抛出异常，默认 false
  errorColor?: string;      // 错误颜色，默认 '#cc0000'
}

// 数学公式装饰器
export const mathDecorator = (options: MathDecoratorOptions = {}) => {
  const {
    enableInline = true,
    enableBlock = true,
    throwOnError = false,
    errorColor = '#cc0000',
  } = options;

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;

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
        const { from, to } = view.viewport;

        // 遍历语法树查找数学公式
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            const nodeText = view.state.doc.sliceString(node.from, node.to);

            // 行内数学公式: $...$
            if (enableInline && this.isInlineMath(nodeText)) {
              const latex = this.extractLatex(nodeText, 'inline');
              const deco = this.createMathDecoration(latex, 'inline');
              if (deco) {
                decorations.push(deco.range(node.from, node.to));
              }
            }

            // 块级数学公式: $$...$$
            if (enableBlock && this.isBlockMath(nodeText)) {
              const latex = this.extractLatex(nodeText, 'block');
              const deco = this.createMathDecoration(latex, 'block');
              if (deco) {
                decorations.push(deco.range(node.from, node.to));
              }
            }
          },
        });

        return Decoration.set(decorations);
      }

      // 判断是否为行内数学公式
      isInlineMath(text: string): boolean {
        return /^\$[^$\n]+\$$/.test(text);
      }

      // 判断是否为块级数学公式
      isBlockMath(text: string): boolean {
        return /^\$\$[\s\S]*\$\$$/.test(text);
      }

      // 提取 LaTeX 内容
      extractLatex(text: string, type: 'inline' | 'block'): string {
        if (type === 'inline') {
          return text.slice(1, -1).trim();
        }
        return text.slice(2, -2).trim();
      }

      // 创建数学公式装饰
      createMathDecoration(latex: string, type: 'inline' | 'block'): Decoration | null {
        try {
          const html = katex.renderToString(latex, {
            throwOnError,
            displayMode: type === 'block',
            errorColor,
          });

          const dom = document.createElement(type === 'block' ? 'div' : 'span');
          dom.className = `cm-math cm-math-${type}`;
          dom.innerHTML = html;

          // 添加点击编辑功能
          dom.addEventListener('click', (e) => {
            e.preventDefault();
            // 触发编辑模式
          });

          return Decoration.replace({
            widget: new MathWidget(dom, type),
            inclusive: false,
          });
        } catch (error) {
          // 渲染失败时显示错误
          const errorDom = document.createElement(type === 'block' ? 'div' : 'span');
          errorDom.className = `cm-math cm-math-error cm-math-${type}`;
          errorDom.textContent = type === 'inline' ? `$${latex}$` : `$$${latex}$$`;
          errorDom.title = error instanceof Error ? error.message : '渲染错误';

          return Decoration.replace({
            widget: new MathWidget(errorDom, type),
            inclusive: false,
          });
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};

// 数学公式 Widget
class MathWidget extends WidgetType {
  constructor(
    private dom: HTMLElement,
    private type: 'inline' | 'block'
  ) {
    super();
  }

  toDOM(): HTMLElement {
    return this.dom;
  }

  eq(other: MathWidget): boolean {
    return other.dom.innerHTML === this.dom.innerHTML;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
```

### MathRenderer 组件

```vue
<!-- components/MathRenderer.vue -->
<template>
  <component
    :is="displayMode ? 'div' : 'span'"
    :class="['math-renderer', { 'math-error': hasError, 'math-block': displayMode }]"
    v-html="renderedHtml"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import katex from 'katex';

interface Props {
  latex: string;           // LaTeX 公式内容
  displayMode?: boolean;   // 是否为块级显示
  throwOnError?: boolean;  // 错误时抛出
  errorColor?: string;     // 错误颜色
}

const props = withDefaults(defineProps<Props>(), {
  displayMode: false,
  throwOnError: false,
  errorColor: '#cc0000',
});

const hasError = ref(false);

const renderedHtml = computed(() => {
  try {
    hasError.value = false;
    return katex.renderToString(props.latex, {
      throwOnError: props.throwOnError,
      displayMode: props.displayMode,
      errorColor: props.errorColor,
    });
  } catch (error) {
    hasError.value = true;
    // 返回原始文本
    return props.displayMode
      ? `$$${escapeHtml(props.latex)}$$`
      : `$${escapeHtml(props.latex)}$`;
  }
});

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
</script>

<style scoped>
.math-renderer {
  display: inline-flex;
  align-items: center;
}

.math-renderer.math-block {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.math-renderer.math-error {
  color: var(--markly-error, #cc0000);
  background: var(--markly-error-bg, #ffebee);
  padding: 2px 4px;
  border-radius: 3px;
}

/* KaTeX 样式覆盖 */
.math-renderer :deep(.katex) {
  font-size: 1em;
}

.math-renderer.math-block :deep(.katex) {
  font-size: 1.21em;
}

.math-renderer :deep(.katex-display) {
  margin: 0;
}
</style>
```

### KaTeX 样式集成

```typescript
// styles/katex.ts

import 'katex/dist/katex.min.css';

// 自定义 KaTeX 样式覆盖
export const katexCustomStyles = `
  .cm-math {
    cursor: pointer;
  }

  .cm-math:hover {
    background: var(--markly-surfaceHover);
    border-radius: 3px;
  }

  .cm-math-inline {
    display: inline;
  }

  .cm-math-block {
    display: block;
    text-align: center;
    padding: 8px 0;
  }

  .cm-math-error {
    color: var(--markly-error, #cc0000);
    text-decoration: wavy underline;
  }

  .cm-math-error:hover::after {
    content: attr(title);
    position: absolute;
    background: var(--markly-surface);
    border: 1px solid var(--markly-border);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 100;
  }
`;
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-013 | mathDecorator | Decorator | decorators/mathDecorator.ts | FR-005 |
| API-014 | MathRenderer | Component | components/MathRenderer.vue | FR-005 |
| API-015 | insertMath | Method | useToolbar.insertMath | FR-005 |

### 接口详细定义

#### API-013: mathDecorator

**对应PRD**: FR-005

**接口定义**:
```typescript
interface MathDecoratorOptions {
  enableInline?: boolean;   // 启用行内公式
  enableBlock?: boolean;    // 启用块级公式
  throwOnError?: boolean;   // 错误时抛出
  errorColor?: string;      // 错误颜色
}

function mathDecorator(options?: MathDecoratorOptions): Extension;
```

---

## 数据结构

### DATA-006: MathFormula

**对应PRD**: Entity-002 (DocumentConfig 中的数学配置)

```typescript
interface MathFormula {
  type: 'inline' | 'block';
  latex: string;
  from: number;    // 文档起始位置
  to: number;      // 文档结束位置
}

interface MathConfig {
  enabled: boolean;         // 是否启用数学公式
  enableInline: boolean;    // 启用行内公式
  enableBlock: boolean;     // 启用块级公式
  macros?: Record<string, string>;  // 自定义宏
}
```

---

## 边界条件

### BOUND-015: 无效 LaTeX 语法

**对应PRD**: AC-005-02

**边界描述**:
- 输入无效的 LaTeX 语法时应显示错误提示

**处理逻辑**:
```typescript
try {
  const html = katex.renderToString(latex, {
    throwOnError: false,  // 不抛出错误，显示错误样式
    errorColor: '#cc0000',
  });
} catch (error) {
  // 显示错误样式
  dom.className = 'cm-math cm-math-error';
  dom.title = error.message;
}
```

### BOUND-016: 嵌套公式

**对应PRD**: AC-005-03

**边界描述**:
- 处理嵌套的数学公式标记

**处理逻辑**:
```typescript
// 使用正则精确匹配
const inlineMathPattern = /^\$[^$\n]+\$/;   // 行内：$...$
const blockMathPattern = /^\$\$[\s\S]*\$\$$/; // 块级：$$...$$
```

### BOUND-017: 大公式渲染性能

**对应PRD**: AC-005-04

**边界描述**:
- 大型公式渲染可能影响性能

**处理逻辑**:
```typescript
// 限制公式长度
const MAX_FORMULA_LENGTH = 1000;

if (latex.length > MAX_FORMULA_LENGTH) {
  // 显示简化提示
  return Decoration.replace({
    widget: new OversizedMathWidget(latex.length),
  });
}
```

### BOUND-018: 公式编辑

**对应PRD**: AC-005-01

**边界描述**:
- 点击公式应进入编辑模式

**处理逻辑**:
```typescript
dom.addEventListener('click', (e) => {
  e.preventDefault();
  // 找到原始文本位置
  const pos = view.posAtDOM(dom);
  // 选中公式文本
  view.dispatch({
    selection: { anchor: node.from, head: node.to },
  });
  view.focus();
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| decorators/mathDecorator.ts | 数学公式装饰器 |
| components/MathRenderer.vue | 公式渲染组件 |
| styles/katex.ts | KaTeX 样式配置 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-005 | mathDecorator | ✅ |
| 用户故事 | US-005 | API-013~015 | ✅ |
| 验收标准 | AC-005-01 | 点击编辑 | ✅ |
| 验收标准 | AC-005-02 | 错误处理 | ✅ |
| 验收标准 | AC-005-03 | 嵌套公式 | ✅ |
| 验收标准 | AC-005-04 | 性能优化 | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
