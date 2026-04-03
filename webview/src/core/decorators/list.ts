/**
 * 列表装饰器
 * @module core/decorators/list
 * @description IR 模式下将 - 替换为圆点，将 1. 替换为数字样式，将 > 替换为引用样式
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';

export interface ListOptions {
  minimal?: boolean;
}

class BulletWidget extends WidgetType {
  eq() { return true; }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.textContent = '•';
    span.className = 'cm-list-bullet';
    span.style.cssText = 'color: var(--vscode-foreground); font-size: 1.2em; margin-right: 0.4em; user-select: none;';
    return span;
  }

  ignoreEvent() { return true; }
}

class OrderedNumberWidget extends WidgetType {
  constructor(private num: string) { super(); }

  eq(other: OrderedNumberWidget) { return this.num === other.num; }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.textContent = this.num + '.';
    span.className = 'cm-list-number';
    span.style.cssText = 'color: var(--vscode-foreground); margin-right: 0.4em; user-select: none; font-variant-numeric: tabular-nums;';
    return span;
  }

  ignoreEvent() { return true; }
}

class QuoteBarWidget extends WidgetType {
  eq() { return true; }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-quote-bar';
    span.style.cssText = 'display: inline-block; width: 3px; height: 1.2em; background: var(--vscode-textBlockQuote-border, #4078f2); margin-right: 0.6em; vertical-align: text-bottom; border-radius: 1px; user-select: none;';
    return span;
  }

  ignoreEvent() { return true; }
}

const BULLET_RE = /^(\s*)([-*+])\s/;
const ORDERED_RE = /^(\s*)(\d+)\.\s/;
const QUOTE_RE = /^(\s*)(>)\s?/;

export const listDecorator = (options: ListOptions = {}) => {
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

        for (let i = 1; i <= view.state.doc.lines; i++) {
          const line = view.state.doc.line(i);

          // 始终隐藏标记，保持纯 WYSIWYG 样式

          // 跳过任务列表行（由 taskListDecorator 处理）
          if (/^\s*[-*+]\s+\[[ xX]\]/.test(line.text)) continue;

          const bulletMatch = line.text.match(BULLET_RE);
          if (bulletMatch) {
            const indent = bulletMatch[1].length;
            const markerStart = line.from + indent;
            const markerEnd = markerStart + bulletMatch[2].length + 1; // marker + space
            decorations.push(
              Decoration.replace({ widget: new BulletWidget() }).range(markerStart, markerEnd)
            );
            continue;
          }

          const orderedMatch = line.text.match(ORDERED_RE);
          if (orderedMatch) {
            const indent = orderedMatch[1].length;
            const markerStart = line.from + indent;
            const markerEnd = markerStart + orderedMatch[2].length + 2; // number + . + space
            decorations.push(
              Decoration.replace({ widget: new OrderedNumberWidget(orderedMatch[2]) }).range(markerStart, markerEnd)
            );
            continue;
          }

          const quoteMatch = line.text.match(QUOTE_RE);
          if (quoteMatch) {
            const indent = quoteMatch[1].length;
            const markerStart = line.from + indent;
            const markerEnd = markerStart + quoteMatch[0].length - indent;
            decorations.push(
              Decoration.replace({ widget: new QuoteBarWidget() }).range(markerStart, markerEnd)
            );
            // 引用内容样式
            if (markerEnd < line.to) {
              decorations.push(
                Decoration.mark({
                  class: 'cm-quote-content',
                  attributes: {
                    style: 'color: var(--vscode-textBlockQuote-foreground, #6a737d); font-style: italic;',
                  },
                }).range(markerEnd, line.to)
              );
            }
          }
        }

        return Decoration.set(decorations, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
};
