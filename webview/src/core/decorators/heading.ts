/**
 * 标题装饰器
 * @module core/decorators/heading
 * @description IR 模式下隐藏 # 标记，直接渲染标题样式
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';

export interface DecoratorOptions {
  minimal?: boolean;
}

const FONT_SIZES: Record<number, string> = {
  1: '1.75em', 2: '1.5em', 3: '1.25em',
  4: '1.1em', 5: '1em', 6: '0.9em',
};

const COLORS: Record<number, string> = {
  1: 'var(--markly-heading-1, #e45649)',
  2: 'var(--markly-heading-2, #986801)',
  3: 'var(--markly-heading-3, #4078f2)',
  4: 'var(--markly-heading-4, #a626a4)',
  5: 'var(--markly-heading-5, #0184bc)',
  6: 'var(--markly-heading-6, #50a14f)',
};

export const headingDecorator = (options: DecoratorOptions = {}) => {
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
        const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

        tree.iterate({
          enter: (node) => {
            const nodeType = node.type.name;

            if (nodeType.startsWith('ATXHeading')) {
              const level = parseInt(nodeType.replace('ATXHeading', ''), 10);
              if (!isNaN(level) && level >= 1 && level <= 6) {
                const line = view.state.doc.lineAt(node.from);
                const lineText = line.text;
                const match = lineText.match(/^(#{1,6})\s+(.*)$/);
                if (!match) return;

                const hashLen = match[1].length;
                const markerEnd = line.from + hashLen + 1; // include space

                // 始终隐藏 # 标记，保持纯 WYSIWYG 样式
                decorations.push(
                  Decoration.replace({}).range(line.from, markerEnd)
                );

                // 标题内容样式
                if (markerEnd < line.to) {
                  decorations.push(
                    Decoration.mark({
                      class: `cm-heading-content cm-heading-${level}`,
                      attributes: {
                        style: `font-size: ${FONT_SIZES[level]}; font-weight: 700; color: ${COLORS[level]}; line-height: 1.4;`,
                      },
                    }).range(markerEnd, line.to)
                  );
                }
              }
            }

            if (nodeType === 'SetextHeading1' || nodeType === 'SetextHeading2') {
              const level = nodeType === 'SetextHeading1' ? 1 : 2;
              const line = view.state.doc.lineAt(node.from);
              decorations.push(
                Decoration.mark({
                  class: `cm-heading-content cm-heading-${level}`,
                  attributes: {
                    style: `font-size: ${FONT_SIZES[level]}; font-weight: 700; color: ${COLORS[level]}; line-height: 1.4;`,
                  },
                }).range(line.from, line.to)
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
