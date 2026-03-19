# 开发计划 - MOD-005: Diagram Support

## 文档信息
- **模块编号**: MOD-005
- **模块名称**: Diagram Support
- **所属层次**: L5 - 渲染装饰层
- **对应架构**: [12-mod-005-diagram-support.md](../02-architecture/12-mod-005-diagram-support.md)
- **优先级**: P1
- **预估工时**: 1天

---

## 1. 模块概述

### 1.1 模块职责

Diagram Support 负责图表渲染：
- Mermaid 代码块识别
- 流程图、时序图、类图等渲染
- 实时预览
- 错误处理

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-006 | 图表支持 | US-005 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── decorators/
│   ├── diagram.ts            # 图表装饰器
│   └── __tests__/
│       └── diagram.test.ts
├── components/
│   └── DiagramRenderer.vue   # 图表渲染组件
└── config/
    └── mermaid.ts            # Mermaid 配置
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | Mermaid 配置 | 2 | ~80 | - |
| T-02 | diagramDecorator | 2 | ~120 | T-01 |
| T-03 | DiagramRenderer 组件 | 2 | ~80 | T-02 |
| T-04 | 单元测试 | 2 | ~100 | T-01~03 |

---

## 4. 详细任务定义

### T-01: Mermaid 配置

**任务概述**: 配置 Mermaid

**输出**:
- `webview/src/config/mermaid.ts`

**实现要求**:

```typescript
// config/mermaid.ts
import mermaid from 'mermaid';

export interface MermaidConfig {
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  securityLevel: 'strict' | 'loose' | 'antiscript';
}

export const defaultMermaidConfig: MermaidConfig = {
  theme: 'default',
  securityLevel: 'strict',
};

export const initMermaid = (config: Partial<MermaidConfig> = {}) => {
  mermaid.initialize({
    ...defaultMermaidConfig,
    ...config,
  });
};

export const getMermaidTheme = (editorTheme: 'light' | 'dark'): string => {
  return editorTheme === 'dark' ? 'dark' : 'default';
};
```

**预估工时**: 1小时

---

### T-02: diagramDecorator

**任务概述**: 实现图表装饰器

**输出**:
- `webview/src/decorators/diagram.ts`

**实现要求**:

```typescript
// decorators/diagram.ts
import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import mermaid from 'mermaid';

class DiagramWidget extends WidgetType {
  constructor(private code: string, private id: string) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-diagram';
    container.id = this.id;

    mermaid.render(this.id, this.code)
      .then(({ svg }) => {
        container.innerHTML = svg;
      })
      .catch((error) => {
        container.classList.add('cm-diagram-error');
        container.textContent = '图表语法错误';
        container.title = error.message;
      });

    return container;
  }

  eq(other: DiagramWidget): boolean {
    return other.code === this.code;
  }
}

export const diagramDecorator = () => {
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
            if (node.type.name === 'FencedCode') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/^```(\w+)\n?([\s\S]*?)```$/);

              if (match && match[1] === 'mermaid') {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const deco = Decoration.replace({
                  widget: new DiagramWidget(match[2].trim(), id),
                  inclusive: false,
                  block: true,
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

**预估工时**: 3小时

**依赖**: T-01

---

### T-03: DiagramRenderer 组件

**任务概述**: 实现图表渲染组件

**输出**:
- `webview/src/components/DiagramRenderer.vue`

**预估工时**: 2小时

**依赖**: T-02

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/decorators/__tests__/diagram.test.ts`

**预估工时**: 2小时

**依赖**: T-01~03

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-016 diagramDecorator | T-02 | ✅ |
| API-017 DiagramRenderer | T-03 | ✅ |
| API-018 insertMermaid | T-03 | ✅ |
