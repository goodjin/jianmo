import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { getAssistModelOperationsForExtension } from './assistExtensionBridge';
import { mapAssistTitlesResult } from './assistResultMappers';

export type { TitleSuggestion } from './assistTypes';

export async function suggestTitlesViaProvider(
  text: string,
  config: ExtensionConfig,
  context: vscode.ExtensionContext
): Promise<{ ok: true; items: TitleSuggestion[] } | { ok: false; error: string }> {
  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: '内容为空' };

  const ops = getAssistModelOperationsForExtension(config, context);
  const r = await ops.suggestTitles(input);
  return mapAssistTitlesResult(r);
}
