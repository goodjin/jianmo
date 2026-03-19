/**
 * VS Code 集成共享类型定义
 * @module shared/types
 * @description 定义 Extension 和 Webview 之间的通信协议
 */

// ========== 消息类型 ==========

/**
 * 消息类型枚举
 */
export type MessageType =
  | 'INIT'
  | 'CONTENT_CHANGE'
  | 'DOCUMENT_CHANGE'
  | 'SAVE'
  | 'UPLOAD_IMAGE'
  | 'IMAGE_SAVED'
  | 'CONFIG_CHANGE'
  | 'GET_THEME'
  | 'THEME_CHANGE'
  | 'THEME_APPLIED'
  | 'COMMAND';

/**
 * 基础消息接口
 */
export interface VSCodeMessage {
  type: MessageType;
  payload?: unknown;
}

// ========== Webview → Extension 消息 ==========

/**
 * 内容变化消息
 */
export interface ContentChangeMessage extends VSCodeMessage {
  type: 'CONTENT_CHANGE';
  payload: {
    content: string;
  };
}

/**
 * 保存消息
 */
export interface SaveMessage extends VSCodeMessage {
  type: 'SAVE';
}

/**
 * 上传图片消息
 */
export interface UploadImageMessage extends VSCodeMessage {
  type: 'UPLOAD_IMAGE';
  payload: {
    base64: string;
    filename: string;
  };
}

/**
 * 配置更新消息
 */
export interface ConfigUpdateMessage extends VSCodeMessage {
  type: 'CONFIG_CHANGE';
  payload: {
    key: string;
    value: unknown;
  };
}

/**
 * 获取主题消息
 */
export interface GetThemeMessage extends VSCodeMessage {
  type: 'GET_THEME';
}

// ========== Extension → Webview 消息 ==========

/**
 * 初始化消息
 */
export interface InitMessage extends VSCodeMessage {
  type: 'INIT';
  payload: {
    content: string;
    config: EditorConfig;
  };
}

/**
 * 文档变化消息
 */
export interface DocumentChangeMessage extends VSCodeMessage {
  type: 'DOCUMENT_CHANGE';
  payload: {
    content: string;
  };
}

/**
 * 图片保存完成消息
 */
export interface ImageSavedMessage extends VSCodeMessage {
  type: 'IMAGE_SAVED';
  payload: {
    path: string;
    filename: string;
  };
}

/**
 * 配置变化消息
 */
export interface ConfigChangeMessage extends VSCodeMessage {
  type: 'CONFIG_CHANGE';
  payload: {
    config: Partial<EditorConfig>;
  };
}

/**
 * 主题变化消息
 */
export interface ThemeChangeMessage extends VSCodeMessage {
  type: 'THEME_CHANGE';
  payload: {
    theme: string;
  };
}

/**
 * 主题应用消息
 */
export interface ThemeAppliedMessage extends VSCodeMessage {
  type: 'THEME_APPLIED';
  payload: {
    theme: 'light' | 'dark';
  };
}

/**
 * 命令消息
 */
export interface CommandMessage extends VSCodeMessage {
  type: 'COMMAND';
  payload: {
    command: string;
    args?: unknown[];
  };
}

// ========== 配置类型 ==========

/**
 * 编辑器配置
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
 * VS Code API 接口
 */
export interface VSCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

// ========== 全局声明 ==========

declare global {
  interface Window {
    acquireVsCodeApi: () => VSCodeApi;
    vscode?: VSCodeApi;
  }
}

export {};
