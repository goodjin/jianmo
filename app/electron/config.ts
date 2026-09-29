import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ExtensionConfig } from '../../src/types';

/**
 * 独立应用配置：~/.markly/config.json（与 VSCode 扩展配置项同名，复用 ExtensionConfig 类型）。
 * 纯 Node 实现（fs + os），不依赖 electron-store，便于单测。
 * electron-store 仅用于 webview 状态记忆（getState/setState），见 main.ts。
 */

const CONFIG_DIR = path.join(os.homedir(), '.markly');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 默认值与 package.json configuration defaults 对齐
const DEFAULT_CONFIG: ExtensionConfig = {
  telemetry: { enabled: false },
  editor: {
    theme: 'auto',
    fontSize: 14 as ExtensionConfig['editor']['fontSize'],
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    wrapPolicy: 'autoWrap',
    tableCellWrap: 'wrap',
    enableMermaid: true,
    enableShiki: false,
    richTableColumnResize: 'auto',
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000 as ExtensionConfig['image']['compressThreshold'],
    compressQuality: 0.8 as ExtensionConfig['image']['compressQuality'],
    sameNameHandling: 'rename',
  },
  export: {
    pdf: {
      format: 'A4',
      margin: { top: 25, right: 20, bottom: 25, left: 20 } as ExtensionConfig['export']['pdf']['margin'],
      includeToc: true,
      displayHeaderFooter: true,
      template: 'default',
    },
    html: { theme: 'default' },
    diagram: { mermaidScriptBundling: 'embedded' },
  },
  ai: { rewriteSelectionEnabled: false, rewriteProvider: 'mock' },
};

export function loadAppConfig(): ExtensionConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return DEFAULT_CONFIG;
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const user = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, user);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return (override ?? base) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (typeof override === 'object' && override !== null) {
    for (const k of Object.keys(override as Record<string, unknown>)) {
      out[k] = deepMerge((base as Record<string, unknown>)[k], (override as Record<string, unknown>)[k]);
    }
  }
  return out as T;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

/** 把局部配置写入 ~/.markly/config.json（与现有文件深合并）。 */
export function saveAppConfigPatch(patch: Record<string, unknown>): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = loadAppConfig();
    const merged = deepMerge(current, patch);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // 写入失败不阻断编辑器
  }
}
