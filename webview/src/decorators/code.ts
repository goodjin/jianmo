/**
 * 代码装饰器
 * @module decorators/code
 * @description 实现行内代码的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';

/**
 * 创建代码装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
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
                    font-family: 'Fira Code', 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, monospace;
                    background: var(--markly-codeBackground, rgba(175, 184, 193, 0.2));
                    padding: 0.2em 0.4em;
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

export default codeDecorator;
