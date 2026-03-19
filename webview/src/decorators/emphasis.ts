/**
 * 强调装饰器
 * @module decorators/emphasis
 * @description 实现粗体、斜体、删除线的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';

/**
 * 创建强调装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
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

export default emphasisDecorator;
