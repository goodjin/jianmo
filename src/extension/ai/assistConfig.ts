import type { ExtensionConfig } from '@types';
import type { AssistFeatureSnapshot } from './assistTypes';

/** 将 ExtensionConfig 中的 AI 段规范为单层快照（无密钥） */
export function assistFeatureSnapshotFromExtensionConfig(cfg: ExtensionConfig): AssistFeatureSnapshot {
  const ai = cfg.ai;
  return {
    enabled: ai?.rewriteSelectionEnabled === true,
    provider: (ai?.rewriteProvider ?? 'mock') as AssistFeatureSnapshot['provider'],
    endpoint: String(ai?.rewriteEndpoint ?? '').trim(),
    model: String(ai?.rewriteModel ?? '').trim() || 'gpt-4o-mini',
    timeoutMs: Number(ai?.rewriteTimeoutMs ?? 15000),
  };
}
