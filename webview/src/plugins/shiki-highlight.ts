/**
 * Shiki 代码高亮插件
 * 基于 Milkdown 的 @milkdown/plugin-highlight
 * 
 * 使用 Shiki 进行代码高亮，支持多种编程语言和主题
 */

import { $ctx, $prose } from '@milkdown/utils';
import { createHighlightPlugin } from 'prosemirror-highlight';
import { createParser } from 'prosemirror-highlight/shiki';
import { createHighlighter, type Highlighter } from 'shiki';

// 全局高亮器实例
let highlighter: Highlighter | null = null;

// 默认主题配置
const defaultThemes = {
  light: 'github-light',
  dark: 'github-dark',
};

// 默认支持的语言
const defaultLangs = [
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
  'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala',
  'html', 'css', 'scss', 'json', 'yaml', 'xml', 'markdown',
  'sql', 'bash', 'shell', 'powershell', 'dockerfile', 'graphql',
  'lua', 'perl', 'r', 'matlab', 'latex', 'vim', 'makefile',
  'cmake', 'nginx', 'toml', 'ini', 'diff', 'plaintext',
  'mermaid',
];

/**
 * 获取或创建 Shiki 高亮器实例
 */
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: defaultThemes,
      langs: defaultLangs,
    });
  }
  return highlighter;
}

/**
 * ShikiHighlight 配置选项
 */
export interface ShikiHighlightOptions {
  /**
   * 自定义主题
   */
  themes?: {
    light?: string;
    dark?: string;
  };
  /**
   * 自定义语言
   */
  langs?: string[];
}

/**
 * 创建 Shiki 代码高亮插件
 * @param options - 配置选项
 */
export function shikiHighlight(options: ShikiHighlightOptions = {}) {
  // 自定义主题
  const themes = {
    light: options.themes?.light || 'github-light',
    dark: options.themes?.dark || 'github-dark',
  };

  // 创建配置上下文
  const highlightPluginConfig = $ctx(
    {
      parser: null,
    },
    'highlightPluginConfig'
  );
  
  highlightPluginConfig.meta = {
    package: '@milkdown/plugin-highlight',
    displayName: 'Ctx<ShikiHighlightConfig>',
  };

  // 创建高亮插件
  const highlightPlugin = $prose(async (ctx) => {
    const config = ctx.get(highlightPluginConfig.key);
    
    // 如果还没有 parser，创建一个
    if (!config.parser) {
      try {
        const hl = await getHighlighter();
        
        // 创建 parser，使用默认主题，添加错误处理
        const baseParser = createParser(hl, {
          theme: themes.light,
        });
        
        // 包装 parser 以处理不支持的语言
        const parser = (text: string, language: string) => {
          try {
            // 检查语言是否支持
            if (language && !isLanguageSupported(language)) {
              console.warn(`Language "${language}" is not supported, falling back to plaintext`);
              language = 'plaintext';
            }
            return baseParser(text, language);
          } catch (error) {
            // 优雅降级：返回未高亮的纯文本
            console.warn(`Failed to highlight code block with language "${language}":`, error);
            return baseParser(text, 'plaintext');
          }
        };
        
        // 更新配置
        ctx.set(highlightPluginConfig.key, { parser });
      } catch (error) {
        console.error('Failed to initialize Shiki highlighter:', error);
      }
    }
    
    return createHighlightPlugin(config);
  });

  highlightPlugin.meta = {
    package: '@milkdown/plugin-highlight',
    displayName: 'Shiki Highlight Plugin',
  };

  return [
    highlightPluginConfig,
    highlightPlugin,
  ];
}

// 导出支持的语言列表
export const supportedLanguages = defaultLangs;

/**
 * 检查语言是否支持
 * @param lang - 语言标识符
 */
export function isLanguageSupported(lang: string): boolean {
  return defaultLangs.includes(lang.toLowerCase());
}
