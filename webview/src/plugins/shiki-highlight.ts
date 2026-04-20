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
const defaultThemes = ['github-light', 'github-dark'] as const;

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
      // shiki@1.x/2.x/3.x 的 createHighlighter 期望 themes 为数组/可迭代，而不是 { light, dark } 这种对象；
      // 传错会触发 `(s.themes ?? []).map is not a function` 并导致 Milkdown 初始化失败。
      themes: [...defaultThemes],
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
  const langs = options.langs?.length ? options.langs : defaultLangs;

  // 创建配置上下文
  const highlightPluginConfig = $ctx(
    {
      // prosemirror-highlight 要求 parser 是函数；保持一个永不抛错的默认实现，避免初始化阶段因高亮失败而把编辑器整体拖死
      parser: () => [],
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
    if ((config as any).parser?.__marklyShikiReady !== true) {
      try {
        if (!highlighter) {
          highlighter = await createHighlighter({
            themes: [themes.light, themes.dark],
            langs,
          });
        }
        const baseParser = createParser(highlighter, { theme: themes.light });
        const safeParser = (opts: { content: string; language?: string; pos: number; size: number }) => {
          try {
            const lang = opts.language && isLanguageSupported(opts.language) ? opts.language : 'plaintext';
            return baseParser({ ...opts, language: lang });
          } catch (error) {
            console.warn(`[shikiHighlight] highlight failed, fallback to plaintext:`, error);
            try {
              return baseParser({ ...opts, language: 'plaintext' });
            } catch {
              return [];
            }
          }
        };
        (safeParser as any).__marklyShikiReady = true;
        ctx.set(highlightPluginConfig.key, { parser: safeParser });
      } catch (error) {
        // 失败则保持默认 parser（空 decorations），不要阻断 Milkdown 初始化
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
