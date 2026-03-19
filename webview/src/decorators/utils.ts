/**
 * 装饰器工具函数
 * @module decorators/utils
 * @description 提供装饰器创建的基础工具函数
 */

import type { Range } from '@codemirror/state';
import { Decoration, type WidgetType, type EditorView } from '@codemirror/view';

/**
 * 创建标记装饰器
 * @param className - CSS 类名
 * @param attributes - 可选的 HTML 属性
 * @returns Decoration 实例
 */
export const createMarkDecoration = (
  className: string,
  attributes?: Record<string, string>
): Decoration => {
  return Decoration.mark({
    class: className,
    attributes,
  });
};

/**
 * 创建替换装饰器（用于 Widget）
 * @param widget - Widget 实例
 * @param options - 可选配置
 * @returns Decoration 实例
 */
export const createReplaceDecoration = (
  widget: WidgetType,
  options?: {
    inclusive?: boolean;
    block?: boolean;
  }
): Decoration => {
  return Decoration.replace({
    widget,
    inclusive: options?.inclusive ?? false,
    block: options?.block ?? false,
  });
};

/**
 * 创建行内装饰器
 * @param widget - Widget 实例
 * @param side - 位置偏移（-1 表示左侧，1 表示右侧）
 * @returns Decoration 实例
 */
export const createWidgetDecoration = (
  widget: WidgetType,
  side?: number
): Decoration => {
  return Decoration.widget({
    widget,
    side,
  });
};

/**
 * 获取编辑器中的文本内容
 * @param view - EditorView 实例
 * @param from - 起始位置
 * @param to - 结束位置
 * @returns 文本内容
 */
export const getNodeText = (view: EditorView, from: number, to: number): string => {
  return view.state.doc.sliceString(from, to);
};

/**
 * 创建装饰器范围
 * @param decoration - Decoration 实例
 * @param from - 起始位置
 * @param to - 结束位置
 * @returns Range<Decoration>
 */
export const createDecorationRange = (
  decoration: Decoration,
  from: number,
  to?: number
): Range<Decoration> => {
  return decoration.range(from, to ?? from);
};

/**
 * 解析链接文本
 * @param text - Markdown 链接文本，如 [text](url)
 * @returns 解析结果
 */
export const parseLink = (text: string): { text: string; url: string } | null => {
  const match = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (match) {
    return { text: match[1], url: match[2] };
  }
  return null;
};

/**
 * 解析任务列表项
 * @param text - 列表项文本，如 "- [ ] task" 或 "- [x] task"
 * @returns 解析结果
 */
export const parseTaskList = (text: string): { checked: boolean; content: string } | null => {
  const match = text.match(/^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/);
  if (match) {
    return { checked: match[1].toLowerCase() === 'x', content: match[2] };
  }
  return null;
};

/**
 * 获取标题级别
 * @param nodeName - 语法树节点名称，如 "ATXHeading1"
 * @returns 标题级别（1-6），如果不是标题则返回 null
 */
export const getHeadingLevel = (nodeName: string): number | null => {
  const match = nodeName.match(/ATXHeading(\d)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

/**
 * 标题字体大小映射
 */
export const headingFontSizes: Record<number, string> = {
  1: '2em',
  2: '1.5em',
  3: '1.25em',
  4: '1em',
  5: '0.875em',
  6: '0.85em',
};
