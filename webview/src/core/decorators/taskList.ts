/**
 * 任务列表装饰器
 * @module core/decorators/taskList
 * @description 将 - [ ] 和 - [x] 渲染为可交互的复选框，隐藏 markdown 标记
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import type { Range } from '@codemirror/state';

export interface TaskListOptions {
  minimal?: boolean;
}

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private position: number
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.position === this.position;
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.checked;
    checkbox.className = 'cm-task-checkbox';
    checkbox.style.cssText = `
      margin: 0 0.5em 0 0;
      cursor: pointer;
      vertical-align: middle;
      width: 1.1em;
      height: 1.1em;
    `;

    checkbox.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    return checkbox;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mousedown' && event.type !== 'mouseup';
  }
}

// 匹配任务列表行: - [ ] text 或 - [x] text
const TASK_RE = /^(\s*)([-*+])\s+(\[[ xX]\])\s*/;

export const taskListDecorator = (options: TaskListOptions = {}) => {
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
        const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

        for (let i = 1; i <= view.state.doc.lines; i++) {
          const line = view.state.doc.line(i);
          const match = line.text.match(TASK_RE);
          if (!match) continue;

          const isCursorLine = i === cursorLine;
          const indent = match[1].length;
          const markerStart = line.from + indent; // start of -
          const checkboxText = match[3]; // [ ] or [x]
          const checkboxStart = markerStart + match[2].length + 1; // after "- "
          const checkboxEnd = checkboxStart + checkboxText.length;
          const fullMarkerEnd = line.from + match[0].length; // end of "- [ ] "
          const checked = checkboxText.toLowerCase().includes('x');

          // 始终隐藏所有标记，保持纯 WYSIWYG 样式
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(checked, checkboxStart),
            }).range(markerStart, fullMarkerEnd)
          );
        }

        return Decoration.set(decorations, true);
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown: (e, view) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('cm-task-checkbox')) {
            const pos = view.posAtDOM(target);
            const line = view.state.doc.lineAt(pos);
            const lineText = line.text;

            const taskMatch = lineText.match(/(\[[ xX]\])/);
            if (taskMatch) {
              const taskStart = line.from + lineText.indexOf(taskMatch[1]);
              const taskEnd = taskStart + taskMatch[1].length;
              const currentChecked = taskMatch[1].toLowerCase().includes('x');
              const newMarker = currentChecked ? '[ ]' : '[x]';

              view.dispatch({
                changes: {
                  from: taskStart,
                  to: taskEnd,
                  insert: newMarker,
                },
              });
            }
            return true;
          }
          return false;
        },
      },
    }
  );
};
