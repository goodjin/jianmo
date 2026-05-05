/** 纯本地 GFM 表格工具（与 Provider 解耦） */
export * from './gfmTableLocal';

import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { getAssistModelOperationsForExtension } from './assistExtensionBridge';
import { mapAssistMarkdownResult } from './assistResultMappers';

export async function textToGfmTableViaProvider(
  text: string,
  config: ExtensionConfig,
  context: vscode.ExtensionContext
): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  const raw = String(text ?? '');
  if (!raw.trim()) return { ok: false, error: '内容为空' };

  const ops = getAssistModelOperationsForExtension(config, context);
  const r = await ops.convertTextToGfmTable(raw);
  return mapAssistMarkdownResult(r);
}
