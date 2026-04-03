/**
 * 图表装饰器
 * @module core/decorators/diagram
 * @description IR 模式下将 ```mermaid ... ``` 替换为 Mermaid 渲染预览。
 *
 * 与 math.ts 同理：block replace decoration 只能来自 StateField，
 * 因此本模块使用 StateField + EditorView.decorations 路线。
 */

import { Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import { StateField, type Range, type Extension } from '@codemirror/state';
import type { DecoratorOptions } from '../../types/decorator';

let diagramCounter = 0;

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

export function computeDiagramDecorations(doc: string): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const pattern = /^```mermaid\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(doc)) !== null) {
    const code = match[1].trim();
    const diagramType = code.split('\n')[0].trim();
    const deco = Decoration.replace({
      widget: new DiagramWidget(code, diagramType),
      inclusive: false,
      block: true,
    });
    decorations.push(deco.range(match.index, match.index + match[0].length));
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const diagramField = StateField.define<DecorationSet>({
  create(state) {
    return computeDiagramDecorations(state.doc.toString());
  },
  update(decos, tr) {
    if (!tr.docChanged) return decos;
    return computeDiagramDecorations(tr.newDoc.toString());
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/**
 * 创建图表装饰器（StateField 路线，支持 block replace）
 */
export const diagramDecorator = (_options: DecoratorOptions = {}): Extension => {
  return diagramField;
};

export default diagramDecorator;
