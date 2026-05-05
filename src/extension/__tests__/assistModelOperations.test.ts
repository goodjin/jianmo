import { describe, expect, it, vi } from 'vitest';

import { createAssistModelOperations } from '../ai/assistModelOperations';
import type { AssistFeatureSnapshot } from '../ai/assistTypes';

function snap(over: Partial<AssistFeatureSnapshot> = {}): AssistFeatureSnapshot {
  return {
    enabled: true,
    provider: 'mock',
    endpoint: '',
    model: 'gpt-4o-mini',
    timeoutMs: 15000,
    ...over,
  };
}

describe('createAssistModelOperations (M80)', () => {
  it('disabled mirrors legacy error strings per surface', async () => {
    const ops = createAssistModelOperations(snap({ enabled: false }), {
      getBearerToken: async () => 'k',
    });
    const rw = await ops.rewriteSelection('a');
    expect(rw.ok).toBe(false);
    if (rw.ok) throw new Error('expected fail');
    expect(rw.error).toContain('rewriteSelection 未启用');

    const sm = await ops.summarize({ text: 'x', scope: 'document' });
    expect(sm.ok).toBe(false);
    if (sm.ok) throw new Error('expected fail');
    expect(sm.error).toContain('AI 未启用');
  });

  it('none uses distinct rewrite vs other errors', async () => {
    const ops = createAssistModelOperations(snap({ provider: 'none' }), { getBearerToken: async () => undefined });
    const rw = await ops.rewriteSelection('a');
    expect(rw.ok).toBe(false);
    if (rw.ok) throw new Error('expected fail');
    expect(rw.error).toContain('rewrite provider');

    const tt = await ops.convertTextToGfmTable('a');
    expect(tt.ok).toBe(false);
    if (tt.ok) throw new Error('expected fail');
    expect(tt.error).toContain('AI provider');
  });

  it('mock rewrite capitalizes and adds period', async () => {
    const ops = createAssistModelOperations(snap(), { getBearerToken: async () => undefined });
    const r = await ops.rewriteSelection('hello');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data).toBe('Hello.');
  });

  it('openai-compatible uses fetch and bearer', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'DONE' } }] }),
    });
    const ops = createAssistModelOperations(
      snap({
        provider: 'openai-compatible',
        endpoint: 'https://example.com/v1/chat/completions',
      }),
      { getBearerToken: async () => 'secret', fetchFn: fetchFn as any }
    );
    const r = await ops.rewriteSelection('x');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data).toBe('DONE');
    expect(fetchFn).toHaveBeenCalled();
    const [, init] = fetchFn.mock.calls[0]!;
    expect(String(init?.headers?.authorization)).toContain('secret');
  });

  it('mock table fails on non-delimited input with stable message', async () => {
    const ops = createAssistModelOperations(snap(), { getBearerToken: async () => undefined });
    const r = await ops.convertTextToGfmTable('not a table');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected fail');
    expect(r.error).toContain('mock');
    expect(r.error).toContain('TSV');
  });
});
