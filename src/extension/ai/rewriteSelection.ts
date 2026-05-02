import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';

const SECRET_KEY = 'markly.ai.apiKey';

/** 避免把 API key 等写进错误提示或日志片段。 */
export function redactAssistErrorSnippet(text: string): string {
  return String(text ?? '')
    .replace(/sk-[a-zA-Z0-9_-]{8,}/gi, 'sk-***')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***');
}

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
  await context.secrets.store(SECRET_KEY, trimmed);
  vscode.window.showInformationMessage('AI API Key 已保存。');
}

export async function clearAiApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
  vscode.window.showInformationMessage('AI API Key 已清除。');
}

export async function rewriteSelectionViaProvider(
  text: string,
  config: ExtensionConfig,
  context: vscode.ExtensionContext
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const enabled = config.ai?.rewriteSelectionEnabled === true;
  if (!enabled) return { ok: false, error: 'rewriteSelection 未启用（markly.ai.rewrite.enabled=false）' };

  const provider = config.ai?.rewriteProvider ?? 'mock';
  if (provider === 'none') return { ok: false, error: 'rewrite provider=none' };

  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: '选区为空' };

  if (provider === 'mock') {
    // 轻量 mock：首字母大写 + 末尾补句号（与 webview mock 的意图一致）
    const s = input.trim();
    const first = s.charAt(0).toUpperCase() + s.slice(1);
    const out = /[。！？.!?]$/.test(first) ? first : `${first}.`;
    return { ok: true, text: out };
  }

  // openai-compatible
  const endpoint = String(config.ai?.rewriteEndpoint ?? '').trim();
  const model = String(config.ai?.rewriteModel ?? '').trim() || 'gpt-4o-mini';
  const timeoutMs = Number(config.ai?.rewriteTimeoutMs ?? 15000);
  if (!endpoint) return { ok: false, error: 'rewrite.endpoint 为空' };

  const apiKey = (await context.secrets.get(SECRET_KEY))?.trim();
  if (!apiKey) return { ok: false, error: '未设置 API Key（运行 “AI: Set API Key”）' };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Rewrite the user text to be clearer and more polished. Keep meaning. Output only rewritten text.' },
          { role: 'user', content: input },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const snippet = body ? redactAssistErrorSnippet(body.slice(0, 200)) : '';
      return { ok: false, error: `AI 请求失败：${resp.status} ${resp.statusText}${snippet ? ` — ${snippet}` : ''}` };
    }

    const data = (await resp.json().catch(() => null)) as any;
    const out = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!out) return { ok: false, error: 'AI 返回空内容' };
    return { ok: true, text: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AI 请求异常：${msg}` };
  } finally {
    clearTimeout(t);
  }
}

