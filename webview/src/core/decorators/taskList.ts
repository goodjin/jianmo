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
        // 性能：装饰只依赖文档内容与视口范围（不依赖 selection）
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.computeDecorations(update.view);
        }
      }

      computeDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const doc = view.state.doc;
        const seenLineNumbers = new Set<number>();

        // 性能：只处理可见范围覆盖的行（滚动时由 viewportChanged 触发重算）
        for (const vr of view.visibleRanges) {
          const fromLine = doc.lineAt(vr.from).number;
          const toLine = doc.lineAt(vr.to).number;

          for (let i = fromLine; i <= toLine; i++) {
            if (seenLineNumbers.has(i)) continue;
            seenLineNumbers.add(i);
            const line = doc.line(i);
            const match = line.text.match(TASK_RE);
            if (!match) continue;

            const indent = match[1].length;
            const markerStart = line.from + indent; // start of -
            const checkboxText = match[3]; // [ ] or [x]
            const checkboxStart = markerStart + match[2].length + 1; // after "- "
            const fullMarkerEnd = line.from + match[0].length; // end of "- [ ] "
            const checked = checkboxText.toLowerCase().includes('x');

            // 始终隐藏所有标记，保持纯 WYSIWYG 样式
            decorations.push(
              Decoration.replace({
                widget: new CheckboxWidget(checked, checkboxStart),
              }).range(markerStart, fullMarkerEnd)
            );
          }
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
            e.preventDefault();
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
