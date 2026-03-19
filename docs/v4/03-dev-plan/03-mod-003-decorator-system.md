# 开发计划 - MOD-003: Decorator System

## 文档信息
- **模块编号**: MOD-003
- **模块名称**: Decorator System
- **所属层次**: L5 - 渲染装饰层
- **对应架构**: [04-mod-003-decorator-system.md](../02-architecture/04-mod-003-decorator-system.md)
- **优先级**: P0
- **预估工时**: 2.5天

---

## 1. 模块概述

### 1.1 模块职责

Decorator System 负责实现所见即所得的 Markdown 渲染效果：
- 标题装饰器（H1-H6 样式渲染）
- 强调装饰器（粗体、斜体、删除线）
- 链接装饰器（可点击链接）
- 代码装饰器（行内代码样式）
- 任务列表装饰器（复选框）
- 数学公式装饰器（KaTeX 渲染）

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-001 | 即时渲染模式 | US-001 |
| FR-004 | GFM 完整支持 | US-004 |
| FR-005 | 数学公式支持 | US-005 |

### 1.3 架构定位

```
L3: Editor Core
    ↓
L5: Decorator System (本模块)
    ↓
L6: UI Components
```

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── decorators/
│   ├── index.ts              # 装饰器导出
│   ├── heading.ts            # 标题装饰器
│   ├── emphasis.ts           # 强调装饰器
│   ├── link.ts               # 链接装饰器
│   ├── code.ts               # 代码装饰器
│   ├── taskList.ts           # 任务列表装饰器
│   ├── math.ts               # 数学公式装饰器
│   └── __tests__/
│       └── decorators.test.ts
├── styles/
│   └── decorators.css        # 装饰器样式
└── types/
    └── decorator.ts          # 装饰器类型
```

### 2.2 依赖关系

| 依赖项 | 用途 |
|-------|------|
| @codemirror/view | ViewPlugin, Decoration |
| @codemirror/language | syntaxTree |
| @lezer/markdown | Markdown 语法树 |

---

## 3. 接口清单

| 任务编号 | 接口 | 名称 | 复杂度 |
|---------|------|------|-------|
| T-01 | - | 基础装饰器工具 | 中 |
| T-02 | API-010 | headingDecorator | 中 |
| T-03 | API-011 | emphasisDecorator | 低 |
| T-04 | API-012 | linkDecorator | 中 |
| T-05 | API-013 | codeDecorator | 低 |
| T-06 | API-014 | taskListDecorator | 中 |
| T-07 | API-015 | mathDecorator | 高 |
| T-08 | - | 样式定义 | 低 |

---

## 4. 开发任务拆分

### 任务清单

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 基础工具 | 2 | ~100 | - |
| T-02 | 标题装饰器 | 2 | ~80 | T-01 |
| T-03 | 强调装饰器 | 2 | ~60 | T-01 |
| T-04 | 链接装饰器 | 2 | ~80 | T-01 |
| T-05 | 代码装饰器 | 2 | ~60 | T-01 |
| T-06 | 任务列表装饰器 | 2 | ~100 | T-01 |
| T-07 | 数学装饰器 | 2 | ~120 | T-01 |
| T-08 | 样式定义 | 1 | ~150 | T-02~07 |

---

## 5. 详细任务定义

### T-01: 基础装饰器工具

**任务概述**: 创建装饰器基础工具和类型

**输出**:
- `webview/src/decorators/utils.ts`
- `webview/src/types/decorator.ts`

**实现要求**:

```typescript
// types/decorator.ts
import { Decoration } from '@codemirror/view';

export interface DecoratorOptions {
  theme?: 'light' | 'dark';
  classPrefix?: string;
}

export type DecoratorFactory = (options?: DecoratorOptions) => Extension;

// decorators/utils.ts
import { Range } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

export const createMarkDecoration = (
  className: string,
  attributes?: Record<string, string>
): Decoration => {
  return Decoration.mark({
    class: className,
    attributes,
  });
};

export const createWidgetDecoration = (
  widget: WidgetType,
  side?: number
): Decoration => {
  return Decoration.widget({
    widget,
    side,
  });
};

export const getNodeText = (view: EditorView, from: number, to: number): string => {
  return view.state.doc.sliceString(from, to);
};
```

**验收标准**:
- [ ] 工具函数完整
- [ ] 类型定义正确

**预估工时**: 2小时

---

### T-02: 标题装饰器

**任务概述**: 实现标题装饰器

**对应架构**:
- 接口: API-010 headingDecorator

**输出**:
- `webview/src/decorators/heading.ts`

**实现要求**:

```typescript
// decorators/heading.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { DecoratorOptions } from '../types/decorator';

const headingFonts: Record<number, string> = {
  1: '2em',
  2: '1.5em',
  3: '1.25em',
  4: '1em',
  5: '0.875em',
  6: '0.85em',
};

export const headingDecorator = (options: DecoratorOptions = {}) => {
  const prefix = options.classPrefix || 'cm';

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

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            // ATXHeading1 ~ ATXHeading6
            const match = node.type.name.match(/ATXHeading(\d)/);
            if (match) {
              const level = parseInt(match[1], 10);
              const deco = Decoration.mark({
                class: `${prefix}-heading ${prefix}-heading-${level}`,
                attributes: {
                  style: `font-size: ${headingFonts[level]}; font-weight: 700;`,
                },
              });
              decorations.push(deco.range(node.from, node.to));
            }
          },
        });

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**验收标准**:
- [ ] H1-H6 标题样式正确
- [ ] 字体大小递减
- [ ] 粗体显示

**测试要求**:
- 测试标题识别
- 测试样式应用

**预估工时**: 2小时

**依赖**: T-01

---

### T-03: 强调装饰器

**任务概述**: 实现粗体、斜体、删除线装饰器

**对应架构**:
- 接口: API-011 emphasisDecorator

**输出**:
- `webview/src/decorators/emphasis.ts`

**实现要求**:

```typescript
// decorators/emphasis.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { DecoratorOptions } from '../types/decorator';

export const emphasisDecorator = (options: DecoratorOptions = {}) => {
  const prefix = options.classPrefix || 'cm';

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

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            switch (node.type.name) {
              case 'StrongEmphasis':
                decorations.push(
                  Decoration.mark({
                    class: `${prefix}-strong`,
                    attributes: { style: 'font-weight: 700;' },
                  }).range(node.from, node.to)
                );
                break;

              case 'Emphasis':
                decorations.push(
                  Decoration.mark({
                    class: `${prefix}-em`,
                    attributes: { style: 'font-style: italic;' },
                  }).range(node.from, node.to)
                );
                break;

              case 'Strikethrough':
                decorations.push(
                  Decoration.mark({
                    class: `${prefix}-strikethrough`,
                    attributes: { style: 'text-decoration: line-through;' },
                  }).range(node.from, node.to)
                );
                break;
            }
          },
        });

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**验收标准**:
- [ ] 粗体显示正确
- [ ] 斜体显示正确
- [ ] 删除线显示正确

**预估工时**: 1.5小时

**依赖**: T-01

---

### T-04: 链接装饰器

**任务概述**: 实现链接装饰器

**对应架构**:
- 接口: API-012 linkDecorator

**输出**:
- `webview/src/decorators/link.ts`

**实现要求**:

```typescript
// decorators/link.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { DecoratorOptions } from '../types/decorator';

class LinkWidget extends WidgetType {
  constructor(
    private text: string,
    private url: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const link = document.createElement('a');
    link.className = 'cm-link';
    link.href = this.url;
    link.textContent = this.text;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  eq(other: LinkWidget): boolean {
    return other.text === this.text && other.url === this.url;
  }
}

export const linkDecorator = (options: DecoratorOptions = {}) => {
  const prefix = options.classPrefix || 'cm';

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

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.type.name === 'Link') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/\[([^\]]+)\]\(([^)]+)\)/);

              if (match) {
                const [, linkText, url] = match;
                const deco = Decoration.replace({
                  widget: new LinkWidget(linkText, url),
                  inclusive: false,
                });
                decorations.push(deco.range(node.from, node.to));
              }
            }
          },
        });

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**验收标准**:
- [ ] 链接文本显示正确
- [ ] 链接可点击
- [ ] 在新标签页打开

**预估工时**: 2小时

**依赖**: T-01

---

### T-05: 代码装饰器

**任务概述**: 实现行内代码装饰器

**对应架构**:
- 接口: API-013 codeDecorator

**输出**:
- `webview/src/decorators/code.ts`

**实现要求**:

```typescript
// decorators/code.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { DecoratorOptions } from '../types/decorator';

export const codeDecorator = (options: DecoratorOptions = {}) => {
  const prefix = options.classPrefix || 'cm';

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

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.type.name === 'InlineCode') {
              const deco = Decoration.mark({
                class: `${prefix}-code`,
                attributes: {
                  style: `
                    font-family: monospace;
                    background: var(--markly-codeBackground);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 0.9em;
                  `,
                },
              });
              decorations.push(deco.range(node.from, node.to));
            }
          },
        });

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**验收标准**:
- [ ] 等宽字体显示
- [ ] 背景色正确
- [ ] 圆角边框

**预估工时**: 1.5小时

**依赖**: T-01

---

### T-06: 任务列表装饰器

**任务概述**: 实现任务列表复选框装饰器

**对应架构**:
- 接口: API-014 taskListDecorator

**输出**:
- `webview/src/decorators/taskList.ts`

**实现要求**:

```typescript
// decorators/taskList.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import { DecoratorOptions } from '../types/decorator';

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cm-task-checkbox';
    checkbox.checked = this.checked;
    checkbox.disabled = true;
    return checkbox;
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }
}

export const taskListDecorator = (options: DecoratorOptions = {}) => {
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

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            // 任务列表项: - [ ] 或 - [x]
            if (node.type.name === 'ListItem') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/^\s*[-*+]\s+\[([ x])\]/);

              if (match) {
                const checked = match[1] === 'x';
                const deco = Decoration.widget({
                  widget: new CheckboxWidget(checked),
                  side: -1,
                });
                decorations.push(deco.range(node.from));
              }
            }
          },
        });

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
```

**验收标准**:
- [ ] 复选框显示正确
- [ ] 已勾选状态正确
- [ ] 与文本对齐

**预估工时**: 2.5小时

**依赖**: T-01

---

### T-07: 数学装饰器

**任务概述**: 实现数学公式装饰器

**对应架构**:
- 接口: API-015 mathDecorator

**输出**:
- `webview/src/decorators/math.ts`

**实现要求**:

```typescript
// decorators/math.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import katex from 'katex';
import { DecoratorOptions } from '../types/decorator';

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

export const mathDecorator = (options: DecoratorOptions = {}) => {
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

        // 处理行内数学公式 $...$
        const text = view.state.doc.toString();
        const inlinePattern = /\$([^$\n]+)\$/g;
        let match;

        while ((match = inlinePattern.exec(text)) !== null) {
          if (match.index >= from && match.index <= to) {
            const deco = Decoration.replace({
              widget: new MathWidget(match[1], false),
              inclusive: false,
            });
            decorations.push(deco.range(match.index, match.index + match[0].length));
          }
        }

        // 处理块级数学公式 $$...$$
        const blockPattern = /\$\$([\s\S]*?)\$\$/g;
        while ((match = blockPattern.exec(text)) !== null) {
          if (match.index >= from && match.index <= to) {
            const deco = Decoration.replace({
              widget: new MathWidget(match[1].trim(), true),
              inclusive: false,
              block: true,
            });
            decorations.push(deco.range(match.index, match.index + match[0].length));
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

**验收标准**:
- [ ] 行内公式渲染正确
- [ ] 块级公式渲染正确
- [ ] 错误处理完善

**预估工时**: 3小时

**依赖**: T-01

---

### T-08: 样式定义

**任务概述**: 定义装饰器样式

**输出**:
- `webview/src/styles/decorators.css`

**实现要求**:

```css
/* styles/decorators.css */

/* 标题样式 */
.cm-heading {
  color: var(--markly-heading);
  line-height: 1.4;
}

.cm-heading-1 {
  border-bottom: 2px solid var(--markly-border);
  padding-bottom: 0.3em;
}

/* 强调样式 */
.cm-strong {
  font-weight: 700;
}

.cm-em {
  font-style: italic;
}

.cm-strikethrough {
  text-decoration: line-through;
  opacity: 0.7;
}

/* 链接样式 */
.cm-link {
  color: var(--markly-link);
  text-decoration: none;
}

.cm-link:hover {
  color: var(--markly-linkHover);
  text-decoration: underline;
}

/* 代码样式 */
.cm-code {
  color: var(--markly-code);
  background: var(--markly-codeBackground);
  font-family: 'Fira Code', monospace;
}

/* 任务列表样式 */
.cm-task-checkbox {
  margin-right: 0.5em;
  cursor: default;
}

/* 数学公式样式 */
.cm-math {
  cursor: pointer;
}

.cm-math:hover {
  background: var(--markly-surfaceHover);
}

.cm-math-error {
  color: var(--markly-error);
  text-decoration: wavy underline;
}
```

**验收标准**:
- [ ] 所有装饰器样式定义
- [ ] 使用 CSS 变量
- [ ] 支持主题切换

**预估工时**: 2小时

**依赖**: T-02~07

---

## 6. 验收清单

### 6.1 功能验收

- [ ] 所有装饰器正常工作
- [ ] 样式正确应用
- [ ] 性能满足要求

### 6.2 质量验收

- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 TypeScript 错误

---

## 7. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-010 headingDecorator | T-02 | ✅ |
| API-011 emphasisDecorator | T-03 | ✅ |
| API-012 linkDecorator | T-04 | ✅ |
| API-013 codeDecorator | T-05 | ✅ |
| API-014 taskListDecorator | T-06 | ✅ |
| API-015 mathDecorator | T-07 | ✅ |
