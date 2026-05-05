import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { getAssistModelOperationsForExtension } from './assistExtensionBridge';
import { mapAssistTextResult } from './assistResultMappers';

export async function summarizeViaProvider(
  input: { text: string; scope: 'document' | 'section' },
  config: ExtensionConfig,
  context: vscode.ExtensionContext
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const raw = String(input.text ?? '');
  if (!raw.trim()) return { ok: false, error: '内容为空' };

  const ops = getAssistModelOperationsForExtension(config, context);
  const r = await ops.summarize({ text: raw, scope: input.scope });
  return mapAssistTextResult(r);
}
