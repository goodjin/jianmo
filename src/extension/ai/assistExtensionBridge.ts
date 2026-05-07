/**
 * M80：VS Code ExtensionContext → AssistRuntimeDeps；宿主侧唯一绑定点之一。
 */

import type * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { assistFeatureSnapshotFromExtensionConfig } from './assistConfig';
import { type AssistRuntimeDeps } from './assistModelOperations';
import { MARKLY_ASSIST_API_SECRET_KEY } from './assistSecretKey';
import type { AssistModelOperations } from './assistTypes';
import { getAssistProviderFactory } from './assistProviders';

export function assistRuntimeDepsFromExtensionContext(
  context: vscode.ExtensionContext,
  fetchFn?: typeof fetch
): AssistRuntimeDeps {
  return {
    getBearerToken: async () => (await context.secrets.get(MARKLY_ASSIST_API_SECRET_KEY))?.trim(),
    fetchFn,
  };
}

export function getAssistModelOperationsForExtension(
  config: ExtensionConfig,
  context: vscode.ExtensionContext,
  fetchFn?: typeof fetch
): AssistModelOperations {
  const snap = assistFeatureSnapshotFromExtensionConfig(config);
  const deps = assistRuntimeDepsFromExtensionContext(context, fetchFn);
  const factory = getAssistProviderFactory(snap.provider);
  return factory(snap, deps);
}
