import { redactAssistErrorSnippet } from './redactAssistSnippet';

export type ChatCompletionMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export async function openAiCompatibleChatCompletion(opts: {
  endpoint: string;
  model: string;
  timeoutMs: number;
  bearerToken: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  responseFormatJsonObject?: boolean;
  fetchFn?: typeof fetch;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const fn = opts.fetchFn ?? fetch;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1000, opts.timeoutMs));
  try {
    const resp = await fn(opts.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.bearerToken}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature,
        ...(opts.responseFormatJsonObject ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const snippet = body ? redactAssistErrorSnippet(body.slice(0, 200)) : '';
      return { ok: false, error: `AI 请求失败：${resp.status} ${resp.statusText}${snippet ? ` — ${snippet}` : ''}` };
    }

    const data = (await resp.json().catch(() => null)) as any;
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    return { ok: true, content };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AI 请求异常：${msg}` };
  } finally {
    clearTimeout(t);
  }
}
