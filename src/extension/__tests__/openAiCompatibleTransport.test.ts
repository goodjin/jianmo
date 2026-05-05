import { describe, expect, it, vi } from 'vitest';

import { openAiCompatibleChatCompletion } from '../ai/openAiCompatibleTransport';

describe('openAiCompatibleChatCompletion', () => {
  it('returns assistant content on 200', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  hi  ' } }] }),
    });
    const r = await openAiCompatibleChatCompletion({
      endpoint: 'https://x/v1/chat/completions',
      model: 'm',
      timeoutMs: 5000,
      bearerToken: 'tok',
      messages: [{ role: 'user', content: 'a' }],
      temperature: 0.5,
      fetchFn: fetchFn as any,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('expected ok');
    expect(r.content).toBe('hi');
  });

  it('maps non-ok HTTP to error', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => '{"error":"bad"}',
    });
    const r = await openAiCompatibleChatCompletion({
      endpoint: 'https://x/v1/chat/completions',
      model: 'm',
      timeoutMs: 5000,
      bearerToken: 'tok',
      messages: [{ role: 'user', content: 'a' }],
      temperature: 0,
      fetchFn: fetchFn as any,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected fail');
    expect(r.error).toContain('401');
  });
});
