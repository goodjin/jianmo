/**
 * 类型定义入口
 * @module types
 * @description 统一导出所有类型定义
 */

// 编辑器类型
export * from './editor';

// 大纲类型
export interface HeadingNode {
  /** 标题级别 H1-H6 */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** 标题文本 */
  text: string;
  /** 文档起始位置 */
  from: number;
  /** 文档结束位置 */
  to: number;
  /** 所在行号 */
  line: number;
  /** 子标题 */
  children?: HeadingNode[];
  /** 是否折叠 */
  collapsed?: boolean;
}

// 查找替换类型
export interface FindOptions {
  /** 区分大小写 */
  caseSensitive: boolean;
  /** 全字匹配 */
  wholeWord: boolean;
  /** 使用正则 */
  useRegex: boolean;
}

export interface MatchResult {
  from: number;
  to: number;
}

// 图片处理类型
export interface ImageHandlerOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

// 主题类型
export type ThemeType = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  selection: string;
  heading: string;
  link: string;
  linkHover: string;
  code: string;
  codeBackground: string;
}

export interface ThemeConfig {
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
}

// 工具栏类型
export interface ToolbarButton {
  id: string;
  icon: string;
  title: string;
  shortcut?: string;
  action: () => void;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
}

export interface ToolbarGroup {
  id: string;
  buttons: ToolbarButton[];
}

// 装饰器类型
export interface DecoratorOptions {
  theme?: 'light' | 'dark';
  classPrefix?: string;
}

import type { Extension } from '@codemirror/state';

export type DecoratorFactory = (options?: DecoratorOptions) => Extension;
