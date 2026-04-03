/**
 * 行内代码装饰器
 * @module core/decorators/code
 * @description IR 模式下隐藏反引号标记，渲染代码背景样式
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';

export interface CodeOptions {
  minimal?: boolean;
}

export const codeDecorator = (options: CodeOptions = {}) => {
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
            if (node.type.name === 'InlineCode') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const backtickMatch = text.match(/^(`+)(.+?)\1$/);
              if (!backtickMatch) return;

              const btLen = backtickMatch[1].length;
              const contentStart = node.from + btLen;
              const contentEnd = node.to - btLen;
              if (contentStart >= contentEnd) return;

              const cursorInside = selFrom >= node.from && selTo <= node.to;

              // 始终隐藏前后反引号，保持纯 WYSIWYG 样式
              decorations.push(Decoration.replace({}).range(node.from, contentStart));
              decorations.push(Decoration.replace({}).range(contentEnd, node.to));

              decorations.push(
                Decoration.mark({
                  class: 'cm-inline-code-content',
                  attributes: {
                    style: `font-family: var(--vscode-editor-font-family, "SF Mono", Consolas, monospace); font-size: 0.9em; background: var(--vscode-textCodeBlock-background, rgba(175, 184, 193, 0.2)); padding: 0.15em 0.3em; border-radius: 3px; color: var(--vscode-textPreformat-foreground, #24292f);`,
                  },
                }).range(contentStart, contentEnd)
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
