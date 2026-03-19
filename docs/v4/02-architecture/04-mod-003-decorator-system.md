# MOD-003: Decorator System 装饰渲染系统

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-003
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
7. [装饰器实现](#装饰器实现)
8. [边界条件](#边界条件)
9. [实现文件](#实现文件)
10. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L5 - 装饰渲染层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L6: Toolbar, OutlinePanel              │
└─────────────────────┬───────────────────────────────┘
                      │ 调用
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-003: Decorator System ★          │
│              装饰渲染系统                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  • headingDecorator     - 标题样式          │   │
│  │  • emphasisDecorator    - 粗体/斜体         │   │
│  │  • linkDecorator        - 链接样式          │   │
│  │  • codeDecorator        - 行内代码          │   │
│  │  • taskListDecorator    - 任务列表          │   │
│  │  • mathDecorator        - 数学公式          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ 依赖
                      ▼
┌─────────────────────────────────────────────────────┐
│              L4: @codemirror/lang-markdown          │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **WYSIWYG 渲染**: 将 Markdown 语法实时渲染为视觉效果
- **装饰管理**: 管理 CodeMirror 6 Decoration 的创建和更新
- **性能优化**: 仅对可视区域进行装饰，支持虚拟滚动
- **交互支持**: 支持点击、编辑等交互操作

### 边界说明

- **负责**:
  - Markdown 元素的视觉装饰
  - 装饰器的性能优化
  - 装饰与编辑的切换

- **不负责**:
  - Markdown 语法解析（L4 负责）
  - 编辑器状态管理（L3 负责）
  - 用户交互处理（L6 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-001 | 即时渲染模式 |
| 功能需求 | FR-005 | 数学公式支持 |
| 用户故事 | US-001 | 即时渲染编辑 |
| 验收标准 | AC-001-01~05 | 即时渲染相关 |
| 验收标准 | AC-005-01~04 | 数学公式相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         装饰系统架构位置                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ MOD-001: Editor Core                                            │  │
│   │  createExtensions()                                             │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ 组合装饰器                         │
│       ┌────────────────────────────┼────────────────────────────┐     │
│       │                            │                            │     │
│       ▼                            ▼                            ▼     │
│   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐│
│   │ MOD-003:    │            │ MOD-003:    │            │ MOD-003:    ││
│   │ heading     │            │ emphasis    │            │ math        ││
│   │ decorator   │            │ decorator   │            │ decorator   ││
│   └─────────────┘            └─────────────┘            └─────────────┘│
│       │                            │                            │      │
│       └────────────────────────────┼────────────────────────────┘      │
│                                    │ 依赖                              │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ @codemirror/view (ViewPlugin, Decoration)                       │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| Markdown Language | MOD-002 | 语法树解析 | import { syntaxTree } |
| Theme System | MOD-010 | 样式变量 | CSS 变量 |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| Editor Core | MOD-001 | 扩展组合 | extensions: [headingDecorator()] |

### 外部依赖

| 依赖项 | 类型 | 用途 | 版本要求 |
|-------|------|------|---------|
| @codemirror/view | npm | ViewPlugin, Decoration | ^6.0.0 |
| @codemirror/language | npm | syntaxTree | ^6.0.0 |
| @lezer/common | npm | SyntaxNode | ^1.0.0 |

---

## 核心设计

### 装饰器架构

```typescript
// 装饰器通用接口
interface DecoratorSpec {
  // 装饰器名称
  name: string;

  // 匹配语法节点类型
  nodeTypes: string[];

  // 创建装饰
  createDecoration: (node: SyntaxNode, view: EditorView) => Decoration | null;

  // 是否支持交互
  interactive?: boolean;
}

// 装饰器工厂函数类型
type DecoratorFactory = (options?: DecoratorOptions) => Extension;

// 装饰器选项
interface DecoratorOptions {
  // 最小装饰模式（用于分屏模式）
  minimal?: boolean;

  // 自定义样式
  customStyles?: Record<string, string>;
}
```

### 性能优化策略

```typescript
// 1. 仅装饰可视区域
const viewportDecorator = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  update(update: ViewUpdate) {
    // 只在视口变化或文档变化时重新计算
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.computeDecorations(update.view);
    }
  }

  computeDecorations(view: EditorView): DecorationSet {
    const decorations: Range<Decoration>[] = [];

    // 只遍历可视区域
    const { from, to } = view.viewport;

    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        // 处理节点...
      },
    });

    return Decoration.set(decorations);
  }
}, {
  decorations: (v) => v.decorations,
});

// 2. 装饰缓存
const decorationCache = new Map<string, Decoration>();

const getCachedDecoration = (key: string, create: () => Decoration): Decoration => {
  if (!decorationCache.has(key)) {
    decorationCache.set(key, create());
  }
  return decorationCache.get(key)!;
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-010 | headingDecorator | factory | extensions/decorators/heading.ts | FR-001 |
| API-011 | emphasisDecorator | factory | extensions/decorators/emphasis.ts | FR-001 |
| API-012 | linkDecorator | factory | extensions/decorators/link.ts | FR-001 |
| API-013 | codeDecorator | factory | extensions/decorators/code.ts | FR-001 |
| API-014 | taskListDecorator | factory | extensions/decorators/taskList.ts | FR-001 |
| API-015 | mathDecorator | factory | extensions/math/katex.ts | FR-005 |

---

## 装饰器实现

### 1. 标题装饰器 (headingDecorator)

```typescript
// extensions/decorators/heading.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export const headingDecorator = (options: DecoratorOptions = {}) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

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
      const tree = syntaxTree(view.state);

      tree.iterate({
        enter: (node) => {
          const nodeType = node.type.name;

          // 匹配标题节点
          if (nodeType.startsWith('ATXHeading')) {
            const level = parseInt(nodeType.replace('ATXHeading', ''), 10);
            const deco = this.createHeadingDecoration(level, options);
            decorations.push(deco.range(node.from, node.to));
          }

          // Setext 标题 (=== 或 ---)
          if (nodeType === 'SetextHeading1' || nodeType === 'SetextHeading2') {
            const level = nodeType === 'SetextHeading1' ? 1 : 2;
            const deco = this.createHeadingDecoration(level, options);
            decorations.push(deco.range(node.from, node.to));
          }
        },
      });

      return Decoration.set(decorations);
    }

    createHeadingDecoration(level: number, opts: DecoratorOptions): Decoration {
      const fontSizes: Record<number, string> = {
        1: '1.6em',
        2: '1.4em',
        3: '1.2em',
        4: '1.1em',
        5: '1.0em',
        6: '0.9em',
      };

      const colors: Record<number, string> = {
        1: 'var(--markly-heading-1-color, #e45649)',
        2: 'var(--markly-heading-2-color, #986801)',
        3: 'var(--markly-heading-3-color, #4078f2)',
        4: 'var(--markly-heading-4-color, #a626a4)',
        5: 'var(--markly-heading-5-color, #0184bc)',
        6: 'var(--markly-heading-6-color, #50a14f)',
      };

      if (opts.minimal) {
        // 最小装饰模式
        return Decoration.mark({
          class: `cm-heading cm-heading-${level}`,
          attributes: {
            style: `font-weight: 600;`,
          },
        });
      }

      return Decoration.mark({
        class: `cm-heading cm-heading-${level}`,
        attributes: {
          style: `
            font-size: ${fontSizes[level]};
            font-weight: 700;
            color: ${colors[level]};
            line-height: 1.4;
          `.trim(),
        },
      });
    }
  }, {
    decorations: (v) => v.decorations,
  });
};
```

### 2. 强调装饰器 (emphasisDecorator)

```typescript
// extensions/decorators/emphasis.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export const emphasisDecorator = (options: DecoratorOptions = {}) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

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
      const tree = syntaxTree(view.state);

      tree.iterate({
        enter: (node) => {
          const nodeType = node.type.name;

          // 粗体 **text** 或 __text__
          if (nodeType === 'StrongEmphasis') {
            decorations.push(
              Decoration.mark({
                class: 'cm-strong',
                attributes: {
                  style: 'font-weight: 700;',
                },
              }).range(node.from, node.to)
            );
          }

          // 斜体 *text* 或 _text_
          if (nodeType === 'Emphasis') {
            decorations.push(
              Decoration.mark({
                class: 'cm-emphasis',
                attributes: {
                  style: 'font-style: italic;',
                },
              }).range(node.from, node.to)
            );
          }

          // 删除线 ~~text~~
          if (nodeType === 'Strikethrough') {
            decorations.push(
              Decoration.mark({
                class: 'cm-strikethrough',
                attributes: {
                  style: 'text-decoration: line-through; opacity: 0.6;',
                },
              }).range(node.from, node.to)
            );
          }
        },
      });

      return Decoration.set(decorations);
    }
  }, {
    decorations: (v) => v.decorations,
  });
};
```

### 3. 任务列表装饰器 (taskListDecorator)

```typescript
// extensions/decorators/taskList.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

// 自定义 Widget：复选框
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private position: number) {
    super();
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.checked;
    checkbox.className = 'cm-task-list-checkbox';
    checkbox.style.cssText = `
      margin-right: 0.5em;
      cursor: pointer;
      vertical-align: middle;
    `;

    // 点击事件
    checkbox.addEventListener('change', (e) => {
      e.preventDefault();
      // 通过 dispatch 事务来更新文档
      // 实际实现需要访问 EditorView
    });

    return checkbox;
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }
}

export const taskListDecorator = (options: DecoratorOptions = {}) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

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
      const tree = syntaxTree(view.state);

      tree.iterate({
        enter: (node) => {
          // 任务列表项
          if (node.type.name === 'Task') {
            const text = view.state.doc.sliceString(node.from, node.to);
            const checked = text.includes('[x]') || text.includes('[X]');

            // 替换 [ ] 或 [x] 为复选框 widget
            const match = text.match(/\[([ xX])\]/);
            if (match) {
              const checkboxPos = node.from + text.indexOf(match[0]);
              const widget = new CheckboxWidget(checked, checkboxPos);

              decorations.push(
                Decoration.replace({
                  widget,
                  inclusive: true,
                }).range(checkboxPos, checkboxPos + match[0].length)
              );
            }
          }
        },
      });

      return Decoration.set(decorations);
    }
  }, {
    decorations: (v) => v.decorations,
    eventHandlers: {
      // 处理复选框点击
      mousedown: (e, view) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('cm-task-list-checkbox')) {
          // 处理点击逻辑
          return true;
        }
        return false;
      },
    },
  });
};
```

### 4. 数学公式装饰器 (mathDecorator)

```typescript
// extensions/math/katex.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import katex from 'katex';

// KaTeX 渲染 Widget
class MathWidget extends WidgetType {
  constructor(private latex: string, private displayMode: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = this.displayMode ? 'cm-math-block' : 'cm-math-inline';

    try {
      katex.render(this.latex, container, {
        displayMode: this.displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch (error) {
      // 渲染错误时显示原始文本
      container.textContent = this.latex;
      container.classList.add('cm-math-error');
      container.title = String(error);
    }

    return container;
  }

  eq(other: MathWidget): boolean {
    return other.latex === this.latex && other.displayMode === this.displayMode;
  }
}

export const mathDecorator = (options: DecoratorOptions = {}) => {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

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

      // 匹配行内公式 $...$
      const inlineMathRegex = /\$([^$\n]+?)\$/g;
      let match;
      while ((match = inlineMathRegex.exec(text)) !== null) {
        const from = match.index;
        const to = match.index + match[0].length;
        const latex = match[1];

        decorations.push(
          Decoration.replace({
            widget: new MathWidget(latex, false),
            inclusive: false,
          }).range(from, to)
        );
      }

      // 匹配块级公式 $$...$$
      const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
      while ((match = blockMathRegex.exec(text)) !== null) {
        const from = match.index;
        const to = match.index + match[0].length;
        const latex = match[1].trim();

        decorations.push(
          Decoration.replace({
            widget: new MathWidget(latex, true),
            inclusive: false,
            block: true,
          }).range(from, to)
        );
      }

      return Decoration.set(decorations);
    }
  }, {
    decorations: (v) => v.decorations,
  });
};
```

---

## 边界条件

### BOUND-010: 大文件装饰性能

**对应PRD**: 3.1 性能需求

**边界描述**:
- 文件大于 10MB 时，延迟加载装饰器

**处理逻辑**:
```typescript
export const createDecorators = (config: EditorConfig): Extension[] => {
  if (config.largeFileMode) {
    // 大文件模式：仅启用基础装饰
    return [
      headingDecorator({ minimal: true }),
      emphasisDecorator({ minimal: true }),
    ];
  }

  // 正常模式：启用所有装饰
  return [
    headingDecorator(),
    emphasisDecorator(),
    linkDecorator(),
    codeDecorator(),
    taskListDecorator(),
    mathDecorator(),
  ];
};
```

### BOUND-011: 装饰与编辑切换

**对应PRD**: AC-001-05

**边界描述**:
- 光标进入装饰元素时，需要临时隐藏装饰显示原始 Markdown

**处理逻辑**:
```typescript
// 使用 CSS 控制装饰显示/隐藏
const editableDecorator = ViewPlugin.fromClass(class {
  // ...
}, {
  decorations: (v) => v.decorations,
  provide: (plugin) => {
    return EditorView.styleModule.of({
      '.cm-heading': {
        transition: 'opacity 0.15s ease',
      },
      '.cm-editor.cm-focused .cm-cursor': {
        // 光标在装饰内时隐藏装饰
        '& ~ .cm-content .cm-heading': {
          opacity: '0.3',
        },
      },
    });
  },
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| extensions/decorators/heading.ts | 标题装饰器 |
| extensions/decorators/emphasis.ts | 粗体/斜体装饰器 |
| extensions/decorators/link.ts | 链接装饰器 |
| extensions/decorators/code.ts | 行内代码装饰器 |
| extensions/decorators/taskList.ts | 任务列表装饰器 |
| extensions/math/katex.ts | 数学公式装饰器 |
| extensions/decorators/index.ts | 装饰器导出 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-001 | headingDecorator, emphasisDecorator | ✅ |
| 功能需求 | FR-005 | mathDecorator | ✅ |
| 用户故事 | US-001 | API-010~014 | ✅ |
| 验收标准 | AC-001-01 | headingDecorator | ✅ |
| 验收标准 | AC-001-02 | emphasisDecorator | ✅ |
| 验收标准 | AC-001-03 | taskListDecorator | ✅ |
| 验收标准 | AC-005-01~04 | mathDecorator | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
