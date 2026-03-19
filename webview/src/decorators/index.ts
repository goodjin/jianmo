/**
 * 装饰器模块导出
 * @module decorators
 * @description 统一导出所有 Markdown 装饰器
 */

export { headingDecorator } from './heading';
export { emphasisDecorator } from './emphasis';
export { linkDecorator } from './link';
export { codeDecorator } from './code';
export { taskListDecorator } from './taskList';
export { mathDecorator } from './math';

export type { DecoratorOptions, DecoratorFactory, DecoratorType, DecoratorConfig } from '../types/decorator';

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
