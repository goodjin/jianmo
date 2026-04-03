/**
 * 数学公式装饰器
 * @module core/decorators/math
 * @description IR 模式下将 $...$ 和 $$...$$ 替换为 KaTeX 渲染预览。
 *
 * 块级公式（$$...$$）需要 block replace decoration，
 * CM6 只允许 StateField（而非 ViewPlugin）提供 block decorations，
 * 因此本模块使用 StateField + EditorView.decorations 路线。
 */

import { Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import { StateField, type Range, type Extension } from '@codemirror/state';
import type { DecoratorOptions } from '../../types/decorator';

let katex: typeof import('katex') | null = null;

const loadKatex = async (): Promise<typeof import('katex') | null> => {
  if (katex) return katex;
  try {
    katex = await import('katex');
    return katex;
  } catch {
    return null;
  }
};

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

    loadKatex().then((katexModule) => {
      if (katexModule) {
        try {
          container.innerHTML = katexModule.renderToString(this.latex, {
            throwOnError: false,
            displayMode: this.displayMode,
          });
        } catch {
          this.renderError(container);
        }
      } else {
        this.renderError(container);
      }
    });

    return container;
  }

  private renderError(container: HTMLElement): void {
    container.textContent = this.displayMode ? `$$${this.latex}$$` : `$${this.latex}$`;
    container.classList.add('cm-math-error');
  }

  eq(other: MathWidget): boolean {
    return other.latex === this.latex && other.displayMode === this.displayMode;
  }
}

export function computeMathDecorations(doc: string): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  // 块级公式 $$...$$
  const blockPattern = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(doc)) !== null) {
    const deco = Decoration.replace({
      widget: new MathWidget(match[1].trim(), true),
      inclusive: false,
      block: true,
    });
    decorations.push(deco.range(match.index, match.index + match[0].length));
  }

  // 行内公式 $...$（跳过 $$ 开头的匹配）
  const inlinePattern = /\$([^$\n]+)\$/g;
  while ((match = inlinePattern.exec(doc)) !== null) {
    if (match[0].startsWith('$$')) continue;
    const deco = Decoration.replace({
      widget: new MathWidget(match[1], false),
      inclusive: false,
    });
    decorations.push(deco.range(match.index, match.index + match[0].length));
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const mathField = StateField.define<DecorationSet>({
  create(state) {
    return computeMathDecorations(state.doc.toString());
  },
  update(decos, tr) {
    if (!tr.docChanged) return decos;
    return computeMathDecorations(tr.newDoc.toString());
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/**
 * 创建数学公式装饰器（StateField 路线，支持 block replace）
 */
export const mathDecorator = (_options: DecoratorOptions = {}): Extension => {
  return mathField;
};

export default mathDecorator;
