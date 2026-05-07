import * as vscode from 'vscode';

/**
 * M307：i18n 文案外置（extension host）
 *
 * 用法：
 * - t('key')
 * - t('key', arg0, arg1)
 *
 * 对应资源文件：
 * - l10n/bundle.l10n.json
 * - l10n/bundle.l10n.zh-cn.json
 */
export function t(key: string, ...args: Array<string | number | boolean>): string {
  // vscode.l10n.t 支持占位符 {0} {1}...
  return vscode.l10n.t(key, ...(args as any));
}

