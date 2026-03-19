/**
 * 图表装饰器
 * @module decorators/diagram
 * @description 实现 Mermaid 图表的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';

let diagramCounter = 0;

/**
 * 图表 Widget
 */
class DiagramWidget extends WidgetType {
  private id: string;

  constructor(
    private code: string,
    private diagramType: string
  ) {
    super();
    this.id = `mermaid-${Date.now()}-${++diagramCounter}`;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-diagram';
    container.setAttribute('data-diagram-type', this.diagramType);

    this.render(container);
    return container;
  }

  private async render(container: HTMLElement): Promise<void> {
    try {
      const mermaid = (await import('mermaid')).default;
      const { svg } = await mermaid.render(this.id, this.code);
      container.innerHTML = svg;
    } catch (error) {
      container.classList.add('cm-diagram-error');
      container.textContent = '图表语法错误';
      if (error instanceof Error) {
        container.title = error.message;
      }
    }
  }

  eq(other: DiagramWidget): boolean {
    return other.code === this.code;
  }
}

/**
 * 创建图表装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
export const diagramDecorator = (options: DecoratorOptions = {}) => {
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

        // 匹配 mermaid 代码块
        const pattern = /^```mermaid\n([\s\S]*?)^```/gm;
        let match;

        while ((match = pattern.exec(text)) !== null) {
          if (match.index >= from && match.index <= to) {
            const code = match[1].trim();
            const diagramType = code.split('\n')[0].trim();
            const deco = Decoration.replace({
              widget: new DiagramWidget(code, diagramType),
              inclusive: false,
              block: true,
            });
            decorations.push(deco.range(match.index, match.index + match[0].length));
          }
        }

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};

export default diagramDecorator;
