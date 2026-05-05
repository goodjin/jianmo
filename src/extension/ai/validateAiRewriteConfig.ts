import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';
import { assistFeatureSnapshotFromExtensionConfig } from './assistConfig';
import { MARKLY_ASSIST_API_SECRET_KEY } from './assistSecretKey';

export type AiRewriteIssue = {
  code:
    | 'disabled'
    | 'provider_none'
    | 'missing_endpoint'
    | 'bad_endpoint'
    | 'insecure_endpoint'
    | 'missing_model'
    | 'bad_timeout'
    | 'missing_api_key';
  message: string;
};

export function validateAiRewriteConfigSnapshot(input: {
  enabled: boolean;
  provider: 'none' | 'mock' | 'openai-compatible';
  endpoint: string;
  model: string;
  timeoutMs: number;
  hasApiKey: boolean;
}): AiRewriteIssue[] {
  const issues: AiRewriteIssue[] = [];
  if (!input.enabled) return [{ code: 'disabled', message: '未开启「选区润色」（markly.ai.rewrite.enabled=false）。' }];
  if (input.provider === 'none') return [{ code: 'provider_none', message: 'AI provider=none（已禁用）。' }];
  if (input.provider === 'mock') return [];

  const endpoint = String(input.endpoint ?? '').trim();
  const model = String(input.model ?? '').trim();
  const timeoutMs = Number(input.timeoutMs);

  if (!endpoint) {
    issues.push({ code: 'missing_endpoint', message: 'rewrite.endpoint 为空：请配置 openai-compatible endpoint。' });
  } else {
    try {
      const u = new URL(endpoint);
      const isLocal =
        u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1' || u.hostname.endsWith('.local');
      if (!isLocal && u.protocol !== 'https:') {
        issues.push({ code: 'insecure_endpoint', message: 'endpoint 建议使用 https（非 localhost 时）。' });
      }
      if (!/\/v1\/chat\/completions\/?$/i.test(u.pathname)) {
        issues.push({
          code: 'bad_endpoint',
          message: 'endpoint 路径看起来不像 /v1/chat/completions（若是兼容端点可忽略）。',
        });
      }
    } catch {
      issues.push({ code: 'bad_endpoint', message: 'endpoint 不是合法 URL。' });
    }
  }

  if (!model) {
    issues.push({ code: 'missing_model', message: 'rewrite.model 不能为空。' });
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
    issues.push({ code: 'bad_timeout', message: 'rewrite.timeoutMs 建议在 1000–120000ms。' });
  }

  if (!input.hasApiKey) {
    issues.push({ code: 'missing_api_key', message: '未设置 API Key：请运行 “AI: Set API Key”。' });
  }

  return issues;
}

export async function validateAiRewriteSetup(
  context: vscode.ExtensionContext,
  config: ExtensionConfig
): Promise<AiRewriteIssue[]> {
  const snap = assistFeatureSnapshotFromExtensionConfig(config);
  const hasApiKey = !!(await context.secrets.get(MARKLY_ASSIST_API_SECRET_KEY))?.trim();
  return validateAiRewriteConfigSnapshot({
    enabled: snap.enabled,
    provider: snap.provider,
    endpoint: snap.endpoint,
    model: snap.model,
    timeoutMs: snap.timeoutMs,
    hasApiKey,
  });
}

