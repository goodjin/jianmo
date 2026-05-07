import type { AssistFeatureSnapshot, AssistModelOperations, AssistProviderId } from './assistTypes';
import type { AssistRuntimeDeps } from './assistModelOperations';
import { createAssistModelOperations } from './assistModelOperations';

/**
 * M303：AI Provider 扩展点（可选）
 *
 * 目标：把“按 provider 分支”的逻辑集中到 registry，后续新增 provider 只需：
 * - 扩展 AssistProviderId（或改为 string）
 * - 在这里注册 factory
 *
 * 目前仍复用 `createAssistModelOperations` 的实现作为默认 factory。
 */

export type AssistProviderFactory = (snap: AssistFeatureSnapshot, deps: AssistRuntimeDeps) => AssistModelOperations;

export const ASSIST_PROVIDER_FACTORIES: Record<AssistProviderId, AssistProviderFactory> = {
  none: (snap, deps) => createAssistModelOperations({ ...snap, provider: 'none' }, deps),
  mock: (snap, deps) => createAssistModelOperations({ ...snap, provider: 'mock' }, deps),
  'openai-compatible': (snap, deps) => createAssistModelOperations({ ...snap, provider: 'openai-compatible' }, deps),
};

export function getAssistProviderFactory(provider: AssistProviderId | string | undefined): AssistProviderFactory {
  const p = String(provider ?? '').trim() as AssistProviderId;
  return (ASSIST_PROVIDER_FACTORIES as any)[p] ?? ASSIST_PROVIDER_FACTORIES.mock;
}

