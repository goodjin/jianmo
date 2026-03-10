import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';

/**
 * 深度合并两个对象，确保 target 的默认值被保留
 * source 的属性会覆盖 target 的属性，但 target 中有而 source 中没有的键也会保留
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  // 遍历 target 的所有键，确保默认值被保留
  for (const key of Object.keys(target) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    // 如果 source 中有该键的值
    if (key in source && sourceValue !== undefined) {
      // 如果两者都是对象且不为 null，进行深度合并
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue as any, sourceValue as any);
      } else {
        result[key] = sourceValue as T[keyof T];
      }
    }
    // 如果 source 中没有该键，保留 target 的默认值（已在 result 中）
  }

  return result;
}

/**
 * 配置验证结果
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证配置值
 */
function validateConfig(config: ExtensionConfig): ValidationResult {
  const errors: string[] = [];

  // 验证 editor.fontSize (8-72)
  if (typeof config.editor.fontSize !== 'number' || config.editor.fontSize < 8 || config.editor.fontSize > 72) {
    errors.push(`editor.fontSize 必须在 8-72 之间，当前值: ${config.editor.fontSize}`);
  }

  // 验证 editor.theme
  if (!['auto', 'light', 'dark'].includes(config.editor.theme)) {
    errors.push(`editor.theme 必须是 "auto", "light" 或 "dark"，当前值: ${config.editor.theme}`);
  }

  // 验证 image.compressThreshold (支持字节或百分比，> 0 即可)
  if (typeof config.image.compressThreshold !== 'number' || config.image.compressThreshold <= 0) {
    errors.push(`image.compressThreshold 必须大于 0，当前值: ${config.image.compressThreshold}`);
  }

  // 验证 image.compressQuality (0-1)
  if (typeof config.image.compressQuality !== 'number' || config.image.compressQuality < 0 || config.image.compressQuality > 1) {
    errors.push(`image.compressQuality 必须在 0-1 之间，当前值: ${config.image.compressQuality}`);
  }

  // 验证 image.saveDirectory
  if (typeof config.image.saveDirectory !== 'string' || !config.image.saveDirectory.trim()) {
    errors.push(`image.saveDirectory 必须是非空字符串`);
  }

  // 验证 export.pdf.format
  if (!['A4', 'A3', 'Letter', 'Legal'].includes(config.export.pdf.format)) {
    errors.push(`export.pdf.format 必须是 "A4", "A3", "Letter" 或 "Legal"，当前值: ${config.export.pdf.format}`);
  }

  // 验证 export.pdf.margin (0-100)
  const margin = config.export.pdf.margin;
  const marginKeys: (keyof typeof margin)[] = ['top', 'right', 'bottom', 'left'];
  for (const key of marginKeys) {
    if (typeof margin[key] !== 'number' || margin[key] < 0 || margin[key] > 100) {
      errors.push(`export.pdf.margin.${key} 必须在 0-100 之间，当前值: ${margin[key]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ExtensionConfig = {
  editor: {
    theme: 'auto',
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000,
    compressQuality: 0.8,
  },
  export: {
    pdf: {
      format: 'A4',
      margin: {
        top: 25,
        right: 20,
        bottom: 25,
        left: 20,
      },
    },
  },
};

export class ConfigurationStore implements vscode.Disposable {
  private config: ExtensionConfig;
  private disposable: vscode.Disposable;

  constructor() {
    this.config = this.loadConfig();
    
    // 监听配置变化
    this.disposable = vscode.workspace.onDidChangeConfiguration(() => {
      this.reload();
    });
  }

  getConfig(): ExtensionConfig {
    // 返回深拷贝，防止外部修改内部状态
    return JSON.parse(JSON.stringify(this.config));
  }

  reload(): void {
    this.config = this.loadConfig();
  }

  private loadConfig(): ExtensionConfig {
    const vsConfig = vscode.workspace.getConfiguration('markly');

    // 获取用户配置，展开到第一层
    const userEditor = vsConfig.get<Partial<ExtensionConfig['editor']>>('editor', {});
    const userImage = vsConfig.get<Partial<ExtensionConfig['image']>>('image', {});
    const userExport = vsConfig.get<Partial<ExtensionConfig['export']>>('export', {});

    // 获取用户配置中可能存在的更深层的嵌套
    const userExportPdf = vsConfig.get<Partial<ExtensionConfig['export']['pdf']>>('export.pdf', {});
    const userExportPdfMargin = vsConfig.get<Partial<ExtensionConfig['export']['pdf']['margin']>>('export.pdf.margin', {});

    // 构建用户配置对象（处理更深层的嵌套）
    const userConfig: Partial<ExtensionConfig> = {
      editor: userEditor || {},
      image: userImage || {},
      export: {
        ...userExport,
        pdf: {
          ...userExportPdf,
          margin: userExportPdfMargin || {},
        },
      },
    };

    // 深度合并：用户配置覆盖默认值
    const mergedConfig = deepMerge(DEFAULT_CONFIG, userConfig);

    // 验证配置值
    const validation = validateConfig(mergedConfig);
    if (!validation.valid) {
      // 输出警告到 VS Code 窗口
      for (const error of validation.errors) {
        console.warn(`[Markly Config] ${error}`);
      }
      vscode.window.showWarningMessage(`[Markly] 配置验证失败: ${validation.errors.join('; ')}`);
    }

    return mergedConfig;
  }

  dispose(): void {
    this.disposable?.dispose();
  }
}
