# 开发计划 - MOD-004: Math Support

## 文档信息
- **模块编号**: MOD-004
- **模块名称**: Math Support
- **所属层次**: L5 - 渲染装饰层
- **对应架构**: [11-mod-004-math-support.md](../02-architecture/11-mod-004-math-support.md)
- **优先级**: P1
- **预估工时**: 1天

---

## 1. 模块概述

### 1.1 模块职责

Math Support 负责数学公式渲染：
- 行内数学公式渲染（$...$）
- 块级数学公式渲染（$$...$$）
- KaTeX 集成
- 错误处理

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-005 | 数学公式支持 | US-005 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── decorators/
│   ├── math.ts               # 数学装饰器
│   └── __tests__/
│       └── math.test.ts
├── components/
│   └── MathRenderer.vue      # 数学渲染组件
└── styles/
    └── katex.css             # KaTeX 样式
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | mathDecorator | 2 | ~120 | - |
| T-02 | MathRenderer 组件 | 2 | ~80 | T-01 |
| T-03 | 样式定义 | 1 | ~50 | T-01 |
| T-04 | 单元测试 | 2 | ~100 | T-01~02 |

---

## 4. 详细任务定义

### T-01: mathDecorator

**任务概述**: 实现数学公式装饰器

**输出**:
- `webview/src/decorators/math.ts`

**实现要求**:

```typescript
// decorators/math.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { Range } from '@codemirror/state';
import katex from 'katex';

class MathWidget extends WidgetType {
  constructor(
    private latex: string,
    private displayMode: boolean
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement(this.displayMode ? 'div' : 'span');
    container.className = `cm-math ${this.displayMode ? 'cm-math-block' : 'cm-math-inline'}`;

    try {
      container.innerHTML = katex.renderToString(this.latex, {
        throwOnError: false,
        displayMode: this.displayMode,
      });
    } catch (error) {
      container.textContent = this.displayMode ? `$$${this.latex}$$` : `$${this.latex}$`;
      container.classList.add('cm-math-error');
    }

    return container;
  }

  eq(other: MathWidget): boolean {
    return other.latex === this.latex && other.displayMode === this.displayMode;
  }
}

export const mathDecorator = () => {
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
        const text = view.state.doc.toString();
        const { from, to } = view.viewport;

        // 行内公式
        const inlinePattern = /\$([^$\n]+)\$/g;
        let match;
        while ((match = inlinePattern.exec(text)) !== null) {
          if (match.index >= from && match.index <= to) {
            decorations.push(
              Decoration.replace({
                widget: new MathWidget(match[1], false),
                inclusive: false,
              }).range(match.index, match.index + match[0].length)
            );
          }
        }

        // 块级公式
        const blockPattern = /\$\$([\s\S]*?)\$\$/g;
        while ((match = blockPattern.exec(text)) !== null) {
          if (match.index >= from && match.index <= to) {
            decorations.push(
              Decoration.replace({
                widget: new MathWidget(match[1].trim(), true),
                inclusive: false,
                block: true,
              }).range(match.index, match.index + match[0].length)
            );
          }
        }

        return Decoration.set(decorations.sort((a, b) => a.from - b.from));
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**预估工时**: 3小时

---

### T-02: MathRenderer 组件

**任务概述**: 实现数学渲染组件

**输出**:
- `webview/src/components/MathRenderer.vue`

**预估工时**: 2小时

**依赖**: T-01

---

### T-03: 样式定义

**任务概述**: 定义数学公式样式

**输出**:
- `webview/src/styles/katex.css`

**预估工时**: 1小时

**依赖**: T-01

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/decorators/__tests__/math.test.ts`

**预估工时**: 2小时

**依赖**: T-01~02

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-013 mathDecorator | T-01 | ✅ |
| API-014 MathRenderer | T-02 | ✅ |
| API-015 insertMath | T-02 | ✅ |
