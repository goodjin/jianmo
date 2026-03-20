/**
 * 编辑器核心类型定义
 * @module types/editor
 * @description 定义编辑器相关的所有类型、接口和枚举
 */

import type { Ref, ComputedRef } from 'vue';
import type { EditorView } from '@codemirror/view';

/**
 * 编辑器模式类型
 * @description 支持三种编辑模式：
 * - ir: 即时渲染模式 (Instant Rendering)
 * - source: 源码编辑模式
 * - split: 分屏预览模式
 */
export type EditorMode = 'ir' | 'source' | 'split';

/**
 * 编辑器选项接口
 * @description 创建编辑器时的配置选项
 */
export interface EditorOptions {
  /** 初始内容 */
  initialContent?: string;
  /** 初始模式 */
  initialMode?: EditorMode;
  /** 内容变化回调 */
  onChange?: (content: string) => void;
  /** 模式变化回调 */
  onModeChange?: (mode: EditorMode) => void;
}

/**
 * 编辑器实例接口
 * @description useEditor Hook 返回的完整编辑器实例
 */
export interface EditorInstance {
  // ========== 状态 ==========
  /** CodeMirror 编辑器视图实例 */
  view: Ref<EditorView | null>;
  /** 当前编辑模式 */
  mode: Ref<EditorMode>;
  /** 当前内容（计算属性） */
  content: ComputedRef<string>;

  // ========== 核心操作 ==========
  /**
   * 创建编辑器
   * @param container - 容器元素
   */
  createEditor: (container: HTMLElement) => void;
  /**
   * 切换编辑模式
   * @param mode - 目标模式
   */
  switchMode: (mode: EditorMode) => void;
  /**
   * 获取当前内容
   * @returns 编辑器内容字符串
   */
  getContent: () => string;
  /**
   * 设置编辑器内容
   * @param content - 新内容
   */
  setContent: (content: string) => void;
  /**
   * 销毁编辑器实例
   */
  destroy: () => void;

  // ========== 历史操作 ==========
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 是否可撤销 */
  canUndo: ComputedRef<boolean>;
  /** 是否可重做 */
  canRedo: ComputedRef<boolean>;

  // ========== 格式与插入操作 ==========
  /**
   * 应用文本格式
   * @param format - 格式类型 (e.g. 'bold', 'italic', 'h1')
   */
  applyFormat: (format: string) => void;
  /**
   * 插入特定节点或内容
   * @param type - 节点类型 (e.g. 'image', 'link', 'codeBlock')
   */
  insertNode: (type: string) => void;
}

/**
 * 编辑器状态接口
 * @description 用于状态管理的编辑器状态
 */
export interface EditorState {
  /** 当前内容 */
  content: string;
  /** 当前模式 */
  mode: EditorMode;
  /** 是否已修改 */
  isDirty: boolean;
  /** 最后保存时间 */
  lastSavedAt?: Date;
}

/**
 * 编辑器配置接口
 * @description 编辑器的行为配置
 */
export interface EditorConfig {
  /** 主题 */
  theme: 'light' | 'dark' | 'auto';
  /** Tab 大小 */
  tabSize: number;
  /** 是否启用 GFM */
  enableGFM: boolean;
  /** 是否启用数学公式 */
  enableMath: boolean;
  /** 资源路径 */
  assetsPath: string;
}

/**
 * 编辑器事件类型
 */
export type EditorEventType =
  | 'contentChange'
  | 'modeChange'
  | 'selectionChange'
  | 'focus'
  | 'blur';

/**
 * 编辑器事件回调
 */
export type EditorEventCallback = (payload: unknown) => void;

/**
 * 快捷键定义
 */
export interface KeyBinding {
  /** 快捷键组合，如 "Ctrl+B" */
  key: string;
  /** 命令名称 */
  command: string;
  /** 显示名称 */
  label?: string;
}

/**
 * 模式切换事件
 */
export interface ModeChangeEvent {
  /** 旧模式 */
  from: EditorMode;
  /** 新模式 */
  to: EditorMode;
  /** 切换时间 */
  timestamp: number;
}

/**
 * 内容变化事件
 */
export interface ContentChangeEvent {
  /** 新内容 */
  content: string;
  /** 变更时间 */
  timestamp: number;
  /** 是否由用户触发 */
  isUserChange: boolean;
}
