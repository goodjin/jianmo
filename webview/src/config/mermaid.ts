/**
 * Mermaid 配置
 * @module config/mermaid
 * @description 初始化和配置 Mermaid 图表渲染
 */

/**
 * Mermaid 配置选项
 */
export interface MermaidConfig {
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  securityLevel: 'strict' | 'loose' | 'antiscript';
}

/**
 * 默认 Mermaid 配置
 */
export const defaultMermaidConfig: MermaidConfig = {
  theme: 'default',
  securityLevel: 'strict',
};

/**
 * 初始化 Mermaid
 */
export const initMermaid = async (config: Partial<MermaidConfig> = {}): Promise<void> => {
  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      ...defaultMermaidConfig,
      ...config,
    });
  } catch {
    // mermaid 不可用时静默失败
  }
};

/**
 * 根据编辑器主题获取 Mermaid 主题
 */
export const getMermaidTheme = (editorTheme: 'light' | 'dark'): string => {
  return editorTheme === 'dark' ? 'dark' : 'default';
};
