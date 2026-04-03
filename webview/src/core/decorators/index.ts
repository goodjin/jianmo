/**
 * 装饰器导出索引
 * @module core/decorators
 * @description 统一导出所有装饰器
 */

export { headingDecorator } from './heading';
export { emphasisDecorator } from './emphasis';
export { linkDecorator } from './link';
export { codeDecorator } from './code';
export { taskListDecorator } from './taskList';
export { listDecorator } from './list';
export { mathDecorator, computeMathDecorations } from './math';
export { diagramDecorator, computeDiagramDecorations } from './diagram';

export type { DecoratorOptions } from './heading';
export type { EmphasisOptions } from './emphasis';
export type { LinkOptions } from './link';
export type { CodeOptions } from './code';
export type { TaskListOptions } from './taskList';
export type { ListOptions } from './list';

export type { DecoratorOptions as MarkdownDecoratorOptions } from '../../types/decorator';
export {
  createMarkDecoration,
  createReplaceDecoration,
  createWidgetDecoration,
  getNodeText,
  parseLink,
  parseTaskList,
  getHeadingLevel,
  headingFontSizes,
} from './utils';
