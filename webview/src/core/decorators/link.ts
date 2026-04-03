/**
 * 链接装饰器
 * @module core/decorators/link
 * @description IR 模式下隐藏 []() 语法标记，只显示链接文本
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';

export interface LinkOptions {
  minimal?: boolean;
}

export const linkDecorator = (options: LinkOptions = {}) => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.computeDecorations(update.view);
        }
      }

      computeDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const tree = syntaxTree(view.state);
        const { from: selFrom, to: selTo } = view.state.selection.main;

        tree.iterate({
          enter: (node) => {
            const nodeType = node.type.name;

            if (nodeType === 'Link') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/^\[([^\]]*)\](?:\(([^)]*)\)|\[([^\]]*)\])$/);
              if (!match) return;

              const textStart = node.from + 1;
              const textEnd = node.from + 1 + match[1].length;

              // 始终隐藏 [ 和 ](url)，保持纯 WYSIWYG 样式
              decorations.push(Decoration.replace({}).range(node.from, textStart));
              decorations.push(Decoration.replace({}).range(textEnd, node.to));

              // 链接文本样式
              decorations.push(
                Decoration.mark({
                  class: 'cm-link-text',
                  attributes: {
                    style: 'color: var(--vscode-textLink-foreground, #3794ff); text-decoration: underline; cursor: pointer;',
                  },
                }).range(textStart, textEnd)
              );
            }

            if (nodeType === 'Image') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
              if (!match) return;

              const altStart = node.from + 2; // after ![
              const altEnd = node.from + 2 + match[1].length;

              // 始终隐藏 ![ 和 ](url)，保持纯 WYSIWYG 样式
              decorations.push(Decoration.replace({}).range(node.from, altStart));
              decorations.push(Decoration.replace({}).range(altEnd, node.to));

              // 图片描述样式
              decorations.push(
                Decoration.mark({
                  class: 'cm-image-alt',
                  attributes: {
                    style: 'color: var(--vscode-textLink-foreground, #3794ff); font-style: italic;',
                  },
                }).range(altStart, altEnd)
              );
            }

            if (nodeType === 'AutoLink') {
              decorations.push(
                Decoration.mark({
                  class: 'cm-autolink',
                  attributes: {
                    style: 'color: var(--vscode-textLink-foreground, #3794ff); text-decoration: underline;',
                  },
                }).range(node.from, node.to)
              );
            }
          },
        });

        return Decoration.set(decorations, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
