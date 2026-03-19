/**
 * 数学公式装饰器
 * @module decorators/math
 * @description 实现数学公式的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';

// 动态导入 KaTeX 以避免 SSR 问题
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

/**
 * 数学公式 Widget
 */
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

    // 异步渲染 KaTeX
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

/**
 * 创建数学公式装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
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

        // 处理块级数学公式 $$...$$
        const text = view.state.doc.toString();
        const blockPattern = /\$\$([\s\S]*?)\$\$/g;
        let match;

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

        // 处理行内数学公式 $...$
        const inlinePattern = /\$([^$\n]+)\$/g;
        while ((match = inlinePattern.exec(text)) !== null) {
          // 跳过块级公式中的内容
          if (match[0].startsWith('$$')) continue;
          if (match.index >= from && match.index <= to) {
            const deco = Decoration.replace({
              widget: new MathWidget(match[1], false),
              inclusive: false,
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

export default mathDecorator;
