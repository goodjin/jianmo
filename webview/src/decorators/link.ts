/**
 * 链接装饰器
 * @module decorators/link
 * @description 实现 Markdown 链接的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';
import { parseLink } from './utils';

/**
 * 链接 Widget
 */
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

/**
 * 创建链接装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
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
              const parsed = parseLink(text);

              if (parsed) {
                const deco = Decoration.replace({
                  widget: new LinkWidget(parsed.text, parsed.url),
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

export default linkDecorator;
