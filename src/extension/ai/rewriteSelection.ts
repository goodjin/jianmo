import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { getAssistModelOperationsForExtension } from './assistExtensionBridge';
import { mapAssistTextResult } from './assistResultMappers';
import { MARKLY_ASSIST_API_SECRET_KEY } from './assistSecretKey';

export { redactAssistErrorSnippet } from './redactAssistSnippet';

export async function setAiApiKey(context: vscode.ExtensionContext): Promise<void> {
  const value = await vscode.window.showInputBox({
    title: '设置 AI API Key',
    prompt: 'API Key 将保存在 VSCode SecretStorage（不会写入 settings.json）',
    password: true,
    ignoreFocusOut: true,
  });
  if (value === undefined) return;
  const trimmed = value.trim();
  if (!trimmed) {
    vscode.window.showWarningMessage('API Key 不能为空。');
    return;
  }
  await context.secrets.store(MARKLY_ASSIST_API_SECRET_KEY, trimmed);
  vscode.window.showInformationMessage('AI API Key 已保存。');
}

export async function clearAiApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(MARKLY_ASSIST_API_SECRET_KEY);
  vscode.window.showInformationMessage('AI API Key 已清除。');
}

export async function rewriteSelectionViaProvider(
  text: string,
  config: ExtensionConfig,
  context: vscode.ExtensionContext
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: '选区为空' };

  const ops = getAssistModelOperationsForExtension(config, context);
  const r = await ops.rewriteSelection(input);
  return mapAssistTextResult(r);
}
