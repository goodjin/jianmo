/**
 * 标题装饰器
 * @module decorators/heading
 * @description 实现 Markdown 标题的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';
import { getHeadingLevel, headingFontSizes } from './utils';

/**
 * 创建标题装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
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
            const level = getHeadingLevel(node.type.name);
            if (level) {
              const fontSize = headingFontSizes[level] || '1em';
              const deco = Decoration.mark({
                class: `${prefix}-heading ${prefix}-heading-${level}`,
                attributes: {
                  style: `font-size: ${fontSize}; font-weight: 700;`,
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

export default headingDecorator;
