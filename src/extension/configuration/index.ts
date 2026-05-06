import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';

/**
 * 深度合并两个对象，确保 target 的默认值被保留
 * source 的属性会覆盖 target 的属性，但 target 中有而 source 中没有的键也会保留
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
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
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证配置值
 */
export function validateConfig(config: ExtensionConfig): ValidationResult {
  const errors: string[] = [];

  // 验证 editor.fontSize (8-72)
  if (typeof config.editor.fontSize !== 'number' || config.editor.fontSize < 8 || config.editor.fontSize > 72) {
    errors.push(`editor.fontSize 必须在 8-72 之间，当前值: ${config.editor.fontSize}`);
  }

  // 验证 editor.theme
  if (!['auto', 'light', 'dark'].includes(config.editor.theme)) {
    errors.push(`editor.theme 必须是 "auto", "light" 或 "dark"，当前值: ${config.editor.theme}`);
  }

  // 验证 editor.wrapPolicy
  if (!['autoWrap', 'preferScroll'].includes((config.editor as any).wrapPolicy)) {
    errors.push(`editor.wrapPolicy 必须是 "autoWrap" 或 "preferScroll"，当前值: ${(config.editor as any).wrapPolicy}`);
  }

  // 验证 editor.tableCellWrap
  if (!['wrap', 'nowrap'].includes((config.editor as any).tableCellWrap)) {
    errors.push(`editor.tableCellWrap 必须是 "wrap" 或 "nowrap"，当前值: ${(config.editor as any).tableCellWrap}`);
  }

  // 验证 enableMermaid/enableShiki
  if (typeof (config.editor as any).enableMermaid !== 'boolean') {
    errors.push(`editor.enableMermaid 必须是 boolean，当前值: ${(config.editor as any).enableMermaid}`);
  }
  if (typeof (config.editor as any).enableShiki !== 'boolean') {
    errors.push(`editor.enableShiki 必须是 boolean，当前值: ${(config.editor as any).enableShiki}`);
  }

  const rtc = (config.editor as ExtensionConfig['editor']).richTableColumnResize;
  if (rtc !== 'auto' && rtc !== 'on' && rtc !== 'off') {
    errors.push(`editor.richTableColumnResize 必须是 auto|on|off，当前值: ${String(rtc)}`);
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

  const sn = (config.image as ExtensionConfig['image']).sameNameHandling;
  if (sn !== 'overwrite' && sn !== 'rename' && sn !== 'prompt') {
    errors.push(`image.sameNameHandling 必须是 overwrite|rename|prompt，当前值: ${String(sn)}`);
  }

  const ral = (config.image as ExtensionConfig['image']).remoteHttpsHostsAllowlist;
  if (
    ral !== undefined &&
    (!Array.isArray(ral) || !ral.every((h) => typeof h === 'string' && String(h).trim().length))
  ) {
    errors.push('image.remoteHttpsHostsAllowlist 须为「非空 host 字符串」数组，未启用时请留空数组或删除键');
  }

  const ddr = config.editor.deferDiagramRenderInRich;
  if (ddr !== undefined && typeof ddr !== 'boolean') {
    errors.push(`editor.deferDiagramRenderInRich 必须是 boolean，当前值: ${String(ddr)}`);
  }

  const msb = config.export.diagram?.mermaidScriptBundling;
  if (msb !== undefined && msb !== 'embedded' && msb !== 'external') {
    errors.push(`export.diagram.mermaidScriptBundling 必须是 embedded|external，当前值: ${String(msb)}`);
  }

  // 验证 export.pdf.format
  if (!['A4', 'A3', 'Letter', 'Legal'].includes(config.export.pdf.format)) {
    errors.push(`export.pdf.format 必须是 "A4", "A3", "Letter" 或 "Legal"，当前值: ${config.export.pdf.format}`);
  }

  const pdfTpl = config.export.pdf.template ?? 'default';
  if (pdfTpl !== 'default' && pdfTpl !== 'academic') {
    errors.push(`export.pdf.template 必须是 "default" 或 "academic"，当前值: ${String(pdfTpl)}`);
  }

  // 验证 export.pdf.margin (0-100)
  const margin = config.export.pdf.margin;
  const marginKeys: (keyof typeof margin)[] = ['top', 'right', 'bottom', 'left'];
  for (const key of marginKeys) {
    if (typeof margin[key] !== 'number' || margin[key] < 0 || margin[key] > 100) {
      errors.push(`export.pdf.margin.${String(key)} 必须在 0-100 之间，当前值: ${margin[key]}`);
    }
  }

  if (config.export.html) {
    const th = config.export.html.theme;
    if (th !== 'default' && th !== 'print-friendly') {
      errors.push(`export.html.theme 必须是 "default" 或 "print-friendly"，当前值: ${String(th)}`);
    }
    const cli = config.export.html.copyLocalImages;
    if (cli !== undefined && typeof cli !== 'boolean') {
      errors.push(`export.html.copyLocalImages 必须是 boolean，当前值: ${String(cli)}`);
    }
    const sub = config.export.html.assetsSubdirectory ?? 'markly-html-assets';
    if (typeof sub !== 'string' || !sub.trim()) {
      errors.push('export.html.assetsSubdirectory 必须为非空字符串');
    } else if (sub.includes('..') || sub.includes('/') || sub.includes('\\')) {
      errors.push('export.html.assetsSubdirectory 必须为单层目录名，不能含 .. 或路径分隔符');
    }
  }

  const pre = config.export.preflight;
  if (pre) {
    const sc = pre.scope;
    if (sc !== 'off' && sc !== 'images' && sc !== 'full') {
      errors.push(`export.preflight.scope 必须是 off、images 或 full，当前值: ${String(sc)}`);
    }
    if (typeof pre.blockOnIssues !== 'boolean') {
      errors.push(`export.preflight.blockOnIssues 必须是 boolean，当前值: ${String(pre.blockOnIssues)}`);
    }
  }

  if (config.templates !== undefined) {
    if (typeof config.templates !== 'object' || config.templates === null || Array.isArray(config.templates)) {
      errors.push(`templates 必须是对象，当前值: ${String(config.templates)}`);
    } else {
      const ud = config.templates.userDirectory;
      if (ud !== undefined && typeof ud !== 'string') {
        errors.push(`templates.userDirectory 必须是 string，当前值: ${String(ud)}`);
      }
    }
  }

  if (typeof config.telemetry?.enabled !== 'boolean') {
    errors.push(`telemetry.enabled 必须是 boolean，当前值: ${String((config as ExtensionConfig).telemetry?.enabled)}`);
  }

  if (config.ai !== undefined && typeof config.ai.rewriteSelectionEnabled !== 'boolean') {
    errors.push(`ai.rewriteSelectionEnabled 必须是 boolean，当前值: ${String(config.ai.rewriteSelectionEnabled)}`);
  }
  if (config.ai) {
    const p = config.ai.rewriteProvider;
    if (p !== undefined && p !== 'none' && p !== 'mock' && p !== 'openai-compatible') {
      errors.push(`ai.rewriteProvider 必须是 "none"|"mock"|"openai-compatible"，当前值: ${String(p)}`);
    }
    if (config.ai.rewriteEndpoint !== undefined && typeof config.ai.rewriteEndpoint !== 'string') {
      errors.push(`ai.rewriteEndpoint 必须是 string，当前值: ${String(config.ai.rewriteEndpoint)}`);
    }
    if (config.ai.rewriteModel !== undefined && typeof config.ai.rewriteModel !== 'string') {
      errors.push(`ai.rewriteModel 必须是 string，当前值: ${String(config.ai.rewriteModel)}`);
    }
    if (config.ai.rewriteTimeoutMs !== undefined && typeof config.ai.rewriteTimeoutMs !== 'number') {
      errors.push(`ai.rewriteTimeoutMs 必须是 number，当前值: ${String(config.ai.rewriteTimeoutMs)}`);
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
  telemetry: {
    enabled: false,
  },
  editor: {
    theme: 'auto',
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    wrapPolicy: 'autoWrap',
    tableCellWrap: 'wrap',
    enableMermaid: true,
    deferDiagramRenderInRich: false,
    enableShiki: false,
    richTableColumnResize: 'auto',
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000,
    compressQuality: 0.8,
    sameNameHandling: 'rename',
    pasteImageBasenamePrefix: 'paste',
    remoteHttpsHostsAllowlist: [],
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
      includeToc: true,
      displayHeaderFooter: true,
      template: 'default',
    },
    html: {
      theme: 'default',
      copyLocalImages: false,
      assetsSubdirectory: 'markly-html-assets',
    },
    preflight: {
      scope: 'full',
      blockOnIssues: false,
    },
    diagram: {
      mermaidScriptBundling: 'embedded',
    },
  },
  ai: {
    rewriteSelectionEnabled: false,
    rewriteProvider: 'mock',
    rewriteEndpoint: 'https://api.openai.com/v1/chat/completions',
    rewriteModel: 'gpt-4o-mini',
    rewriteTimeoutMs: 15000,
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
    const imageSameNameHandling =
      vsConfig.get<ExtensionConfig['image']['sameNameHandling']>('image.sameNameHandling', DEFAULT_CONFIG.image.sameNameHandling);
    const userExport = vsConfig.get<Partial<ExtensionConfig['export']>>('export', {});

    // 获取用户配置中可能存在的更深层的嵌套
    const userExportPdf = vsConfig.get<Partial<ExtensionConfig['export']['pdf']>>('export.pdf', {});
    const userExportPdfMargin = vsConfig.get<Partial<ExtensionConfig['export']['pdf']['margin']>>('export.pdf.margin', {});
    const htmlTheme = vsConfig.get<'default' | 'print-friendly'>('export.html.theme', 'default');
    const htmlCopyLocalImages = vsConfig.get<boolean>('export.html.copyLocalImages', false);
    const htmlAssetsSubdirectory =
      vsConfig.get<string>('export.html.assetsSubdirectory', 'markly-html-assets').trim() || 'markly-html-assets';
    const pfScopeRaw = vsConfig.get<string>('export.preflight.scope', 'full');
    const pfScope: 'off' | 'images' | 'full' =
      pfScopeRaw === 'off' || pfScopeRaw === 'images' || pfScopeRaw === 'full' ? pfScopeRaw : 'full';
    const pfBlock = vsConfig.get<boolean>('export.preflight.blockOnIssues', false);
    const diagramBundlingRaw = vsConfig.get<string>('export.diagram.mermaidScriptBundling', 'embedded');
    const diagramBundling =
      diagramBundlingRaw === 'external' || diagramBundlingRaw === 'embedded' ? diagramBundlingRaw : 'embedded';
    const deferDiagramRich = vsConfig.get<boolean>('editor.deferDiagramRenderInRich', false);
    const remoteAllowRaw = vsConfig.get<string[]>('image.remoteHttpsHostsAllowlist', []);
    const remoteAllow =
      Array.isArray(remoteAllowRaw) && remoteAllowRaw.every((h) => typeof h === 'string')
        ? remoteAllowRaw.map((h) => String(h).trim()).filter(Boolean)
        : [];
    const pastePrefixRaw = String(vsConfig.get<string>('image.pasteImageBasenamePrefix', 'paste') ?? 'paste').trim();
    const pastePrefix = pastePrefixRaw || 'paste';
    const pdfIncludeToc = vsConfig.get<boolean>('export.pdf.includeToc', true);
    const pdfDisplayHeaderFooter = vsConfig.get<boolean>('export.pdf.displayHeaderFooter', true);
    const pdfTemplate = vsConfig.get<'default' | 'academic'>('export.pdf.template', 'default');
    const aiRewriteProvider = vsConfig.get<'none' | 'mock' | 'openai-compatible'>('ai.rewrite.provider', 'mock');
    const aiRewriteEndpoint = vsConfig.get<string>('ai.rewrite.endpoint', DEFAULT_CONFIG.ai?.rewriteEndpoint ?? '');
    const aiRewriteModel = vsConfig.get<string>('ai.rewrite.model', DEFAULT_CONFIG.ai?.rewriteModel ?? '');
    const aiRewriteTimeoutMs = vsConfig.get<number>('ai.rewrite.timeoutMs', DEFAULT_CONFIG.ai?.rewriteTimeoutMs ?? 15000);
    const templatesUserDirectory = String(vsConfig.get<string>('templates.userDirectory', '') ?? '').trim();
    const telemetryEnabled = vsConfig.get<boolean>('telemetry.enabled', false);

    // 构建用户配置对象（处理更深层的嵌套）
    const userConfig: Partial<ExtensionConfig> = {
      telemetry: {
        enabled: telemetryEnabled,
      },
      templates: {
        userDirectory: templatesUserDirectory,
      },
      editor: { ...(userEditor || {}), deferDiagramRenderInRich: deferDiagramRich },
      image: {
        ...(userImage || {}),
        sameNameHandling: imageSameNameHandling,
        pasteImageBasenamePrefix: pastePrefix,
        remoteHttpsHostsAllowlist: remoteAllow,
      },
      export: {
        ...userExport,
        diagram: {
          mermaidScriptBundling: diagramBundling,
          ...(typeof userExport === 'object' && userExport !== null && (userExport as any).diagram
            ? ((userExport as any).diagram as object)
            : {}),
        },
        pdf: {
          ...userExportPdf,
          margin: userExportPdfMargin || {},
          includeToc: pdfIncludeToc,
          displayHeaderFooter: pdfDisplayHeaderFooter,
          template: pdfTemplate === 'academic' ? 'academic' : 'default',
        },
        html: {
          theme: htmlTheme === 'print-friendly' ? 'print-friendly' : 'default',
          copyLocalImages: htmlCopyLocalImages,
          assetsSubdirectory: htmlAssetsSubdirectory,
        },
        preflight: {
          scope: pfScope,
          blockOnIssues: pfBlock,
        },
      },
      ai: {
        rewriteSelectionEnabled: vsConfig.get<boolean>('ai.rewrite.enabled', false),
        rewriteProvider: aiRewriteProvider,
        rewriteEndpoint: aiRewriteEndpoint,
        rewriteModel: aiRewriteModel,
        rewriteTimeoutMs: aiRewriteTimeoutMs,
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
