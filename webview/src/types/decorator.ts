/**
 * 装饰器类型定义
 * @module types/decorator
 * @description 定义装饰器系统的类型接口
 */

import type { Extension } from '@codemirror/state';

/**
 * 装饰器选项
 */
export interface DecoratorOptions {
  /** 主题模式 */
  theme?: 'light' | 'dark';
  /** CSS 类名前缀 */
  classPrefix?: string;
}

/**
 * 装饰器工厂函数类型
 */
export type DecoratorFactory = (options?: DecoratorOptions) => Extension;

/**
 * 装饰器类型枚举
 */
export type DecoratorType =
  | 'heading'
  | 'emphasis'
  | 'link'
  | 'code'
  | 'taskList'
  | 'math';

/**
 * 装饰器配置
 */
export interface DecoratorConfig {
  /** 装饰器类型 */
  type: DecoratorType;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级 */
  priority?: number;
}
