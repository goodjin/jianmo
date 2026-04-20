/**
 * 编辑器扩展配置
 * @module core/extensions
 * @description 定义编辑器的各种扩展和主题配置
 */

import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorMode } from '../types';

/**
 * 主题配置
 */
export const editorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    height: '100%',
  },
  '.cm-content': {
    padding: '16px',
    lineHeight: '1.6',
  },
  '.cm-line': {
    padding: '0 4px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--markly-surface, #f5f5f5)',
  },
  '.cm-selectionBackground': {
    backgroundColor:
      'var(--vscode-editor-selectionBackground, var(--markly-selection, #b3d7ff))',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeft: '2px solid',
    borderLeftColor:
      'var(--vscode-editorCursor-foreground, var(--vscode-focusBorder, #007acc))',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
  },
});

/**
 * 获取模式特定的扩展
 * @param mode - 编辑器模式
 * @returns 扩展数组
 */
export const getModeExtensions = (mode: EditorMode): Extension[] => {
  const extensions: Extension[] = [editorTheme];

  if (mode === 'source') {
    extensions.push(
      EditorView.theme({
        '.cm-content': {
          fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
        },
      })
    );
  }

  return extensions;
};

/**
 * 创建更新监听器
 * @param callback - 内容变化回调
 * @returns 扩展
 */
export const createUpdateListener = (
  callback: (content: string) => void
): Extension => {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      callback(update.state.doc.toString());
    }
  });
};
