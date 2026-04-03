/**
 * 强调装饰器
 * @module core/decorators/emphasis
 * @description IR 模式下隐藏标记符，直接渲染粗体、斜体、删除线样式
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';

export interface EmphasisOptions {
  minimal?: boolean;
}

export const emphasisDecorator = (options: EmphasisOptions = {}) => {
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

            if (nodeType === 'StrongEmphasis') {
              this.processMarker(view, node.from, node.to, 2, 'font-weight: 700;', 'cm-strong', selFrom, selTo, decorations);
            }

            if (nodeType === 'Emphasis') {
              this.processMarker(view, node.from, node.to, 1, 'font-style: italic;', 'cm-em', selFrom, selTo, decorations);
            }

            if (nodeType === 'Strikethrough') {
              this.processMarker(view, node.from, node.to, 2, 'text-decoration: line-through; text-decoration-style: solid; opacity: 0.7;', 'cm-strike', selFrom, selTo, decorations);
            }
          },
        });

        return Decoration.set(decorations, true);
      }

      processMarker(
        view: EditorView,
        from: number,
        to: number,
        markerLen: number,
        contentStyle: string,
        className: string,
        selFrom: number,
        selTo: number,
        decorations: Range<Decoration>[]
      ) {
        const contentStart = from + markerLen;
        const contentEnd = to - markerLen;
        if (contentStart >= contentEnd) return;

        // 始终隐藏前后标记符，保持纯 WYSIWYG 样式
        decorations.push(Decoration.replace({}).range(from, contentStart));
        decorations.push(Decoration.replace({}).range(contentEnd, to));

        // 内容样式
        decorations.push(
          Decoration.mark({
            class: className,
            attributes: { style: contentStyle },
          }).range(contentStart, contentEnd)
        );
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
