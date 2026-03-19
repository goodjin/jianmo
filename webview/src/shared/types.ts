/**
 * 共享类型定义
 * @module shared/types
 */

/**
 * 大纲标题节点
 */
export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  from: number;
  to: number;
  line: number;
  children?: HeadingNode[];
  collapsed?: boolean;
}
