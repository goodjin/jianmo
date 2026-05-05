import { describe, expect, it } from 'vitest';
import { validateAiRewriteConfigSnapshot } from '../ai/validateAiRewriteConfig';

describe('validateAiRewriteConfigSnapshot (M71)', () => {
  it('returns disabled when rewrite not enabled', () => {
    const issues = validateAiRewriteConfigSnapshot({
      enabled: false,
      provider: 'openai-compatible',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      timeoutMs: 15000,
      hasApiKey: false,
    });
    expect(issues.map((x) => x.code)).toEqual(['disabled']);
  });

  it('requires endpoint/model/key for openai-compatible', () => {
    const issues = validateAiRewriteConfigSnapshot({
      enabled: true,
      provider: 'openai-compatible',
      endpoint: '',
      model: '',
      timeoutMs: 500,
      hasApiKey: false,
    });
    const codes = issues.map((x) => x.code);
    expect(codes).toContain('missing_endpoint');
    expect(codes).toContain('missing_model');
    expect(codes).toContain('bad_timeout');
    expect(codes).toContain('missing_api_key');
  });

  it('warns about non-https endpoint for non-localhost', () => {
    const issues = validateAiRewriteConfigSnapshot({
      enabled: true,
      provider: 'openai-compatible',
      endpoint: 'http://example.com/v1/chat/completions',
      model: 'm',
      timeoutMs: 15000,
      hasApiKey: true,
    });
    expect(issues.map((x) => x.code)).toContain('insecure_endpoint');
  });

  it('accepts mock provider with enabled flag', () => {
    const issues = validateAiRewriteConfigSnapshot({
      enabled: true,
      provider: 'mock',
      endpoint: '',
      model: '',
      timeoutMs: 0,
      hasApiKey: false,
    });
    expect(issues).toEqual([]);
  });
});

