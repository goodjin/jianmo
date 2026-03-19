/**
 * 任务列表装饰器
 * @module decorators/taskList
 * @description 实现任务列表复选框的 WYSIWYG 渲染
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DecoratorOptions } from '../types/decorator';
import { parseTaskList } from './utils';

/**
 * 复选框 Widget
 */
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cm-task-checkbox';
    checkbox.checked = this.checked;
    checkbox.disabled = true;
    return checkbox;
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }
}

/**
 * 创建任务列表装饰器
 * @param options - 装饰器选项
 * @returns ViewPlugin 扩展
 */
export const taskListDecorator = (options: DecoratorOptions = {}) => {
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
            // 任务列表项: - [ ] 或 - [x]
            if (node.type.name === 'ListItem') {
              const text = view.state.doc.sliceString(node.from, node.to);
              const parsed = parseTaskList(text);

              if (parsed) {
                const deco = Decoration.widget({
                  widget: new CheckboxWidget(parsed.checked),
                  side: -1,
                });
                decorations.push(deco.range(node.from));
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

export default taskListDecorator;
