/**
 * 主题配置
 * @module shared/themeConfig
 * @description 定义主题颜色配置和类型
 */

/**
 * 主题颜色接口
 */
export interface ThemeColors {
  /** 背景色 */
  background: string;
  /** 表面色 */
  surface: string;
  /** 主文本色 */
  text: string;
  /** 次要文本色 */
  textSecondary: string;
  /** 主色调 */
  primary: string;
  /** 选中文本色 */
  selection: string;
  /** 标题色 */
  heading: string;
  /** 链接色 */
  link: string;
  /** 链接悬停色 */
  linkHover: string;
  /** 代码色 */
  code: string;
  /** 代码背景色 */
  codeBackground: string;
}

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 主题名称 */
  name: string;
  /** 主题类型 */
  type: 'light' | 'dark';
  /** 主题颜色 */
  colors: ThemeColors;
}

/**
 * 主题类型
 */
export type ThemeType = 'light' | 'dark' | 'auto';

/**
 * 亮色主题配置
 */
export const lightTheme: ThemeConfig = {
  name: 'Light',
  type: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    textSecondary: '#666666',
    primary: '#0066cc',
    selection: '#b3d7ff',
    heading: '#1a1a1a',
    link: '#0066cc',
    linkHover: '#0052a3',
    code: '#d32f2f',
    codeBackground: '#f5f5f5',
  },
};

/**
 * 暗色主题配置
 */
export const darkTheme: ThemeConfig = {
  name: 'Dark',
  type: 'dark',
  colors: {
    background: '#1e1e1e',
    surface: '#252526',
    text: '#d4d4d4',
    textSecondary: '#a0a0a0',
    primary: '#007acc',
    selection: '#264f78',
    heading: '#e0e0e0',
    link: '#4daafc',
    linkHover: '#6cb8ff',
    code: '#f44747',
    codeBackground: '#2d2d2d',
  },
};

/**
 * 获取主题配置
 * @param type - 主题类型
 * @returns 主题配置
 */
export const getThemeConfig = (type: 'light' | 'dark'): ThemeConfig => {
  return type === 'dark' ? darkTheme : lightTheme;
};
