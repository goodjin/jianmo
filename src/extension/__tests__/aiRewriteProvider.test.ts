import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
}));

import type { ExtensionConfig } from '@types';
import { redactAssistErrorSnippet, rewriteSelectionViaProvider } from '../ai/rewriteSelection';

function mockContext(secrets: Record<string, string | undefined>) {
  return {
    secrets: {
      get: vi.fn(async (k: string) => secrets[k]),
      store: vi.fn(async (k: string, v: string) => {
        secrets[k] = v;
      }),
      delete: vi.fn(async (k: string) => {
        delete secrets[k];
      }),
    },
  } as any;
}

describe('redactAssistErrorSnippet', () => {
  it('masks sk- keys and bearer tokens', () => {
    expect(redactAssistErrorSnippet('err sk-abc1234567890xyz end')).toMatch(/sk-\*\*\*/);
    expect(redactAssistErrorSnippet('Bearer secret-token-here')).toContain('Bearer ***');
  });
});

describe('rewriteSelectionViaProvider', () => {
  it('returns error when feature disabled', async () => {
    const cfg: ExtensionConfig = {
      editor: { theme: 'auto', fontSize: 14 as any, fontFamily: 'system', wrapPolicy: 'autoWrap', tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false },
      image: { saveDirectory: './assets', compressThreshold: 1 as any, compressQuality: 0.8 as any },
      export: { pdf: { format: 'A4', margin: { top: 1 as any, right: 1 as any, bottom: 1 as any, left: 1 as any }, includeToc: true, displayHeaderFooter: true } },
      ai: { rewriteSelectionEnabled: false, rewriteProvider: 'mock' },
    };
    const r = await rewriteSelectionViaProvider('hello', cfg, mockContext({}));
    expect(r.ok).toBe(false);
  });

  it('mock provider rewrites deterministically', async () => {
    const cfg: ExtensionConfig = {
      editor: { theme: 'auto', fontSize: 14 as any, fontFamily: 'system', wrapPolicy: 'autoWrap', tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false },
      image: { saveDirectory: './assets', compressThreshold: 1 as any, compressQuality: 0.8 as any },
      export: { pdf: { format: 'A4', margin: { top: 1 as any, right: 1 as any, bottom: 1 as any, left: 1 as any }, includeToc: true, displayHeaderFooter: true } },
      ai: { rewriteSelectionEnabled: true, rewriteProvider: 'mock' },
    };
    const r = await rewriteSelectionViaProvider('hello', cfg, mockContext({}));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('Hello.');
  });

  it('provider none returns error', async () => {
    const cfg: ExtensionConfig = {
      editor: { theme: 'auto', fontSize: 14 as any, fontFamily: 'system', wrapPolicy: 'autoWrap', tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false },
      image: { saveDirectory: './assets', compressThreshold: 1 as any, compressQuality: 0.8 as any },
      export: { pdf: { format: 'A4', margin: { top: 1 as any, right: 1 as any, bottom: 1 as any, left: 1 as any }, includeToc: true, displayHeaderFooter: true } },
      ai: { rewriteSelectionEnabled: true, rewriteProvider: 'none' },
    };
    const r = await rewriteSelectionViaProvider('hello', cfg, mockContext({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('none');
  });

  it('openai-compatible errors when api key missing', async () => {
    const cfg: ExtensionConfig = {
      editor: { theme: 'auto', fontSize: 14 as any, fontFamily: 'system', wrapPolicy: 'autoWrap', tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false },
      image: { saveDirectory: './assets', compressThreshold: 1 as any, compressQuality: 0.8 as any },
      export: { pdf: { format: 'A4', margin: { top: 1 as any, right: 1 as any, bottom: 1 as any, left: 1 as any }, includeToc: true, displayHeaderFooter: true } },
      ai: {
        rewriteSelectionEnabled: true,
        rewriteProvider: 'openai-compatible',
        rewriteEndpoint: 'https://example.com/v1/chat/completions',
        rewriteModel: 'gpt-x',
        rewriteTimeoutMs: 1000,
      },
    };
    const r = await rewriteSelectionViaProvider('hello', cfg, mockContext({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('API Key');
  });

  it('openai-compatible returns message content on success', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ choices: [{ message: { content: '  Polished.  ' } }] }),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock as any);
    try {
      const cfg: ExtensionConfig = {
        editor: { theme: 'auto', fontSize: 14 as any, fontFamily: 'system', wrapPolicy: 'autoWrap', tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false },
        image: { saveDirectory: './assets', compressThreshold: 1 as any, compressQuality: 0.8 as any },
        export: { pdf: { format: 'A4', margin: { top: 1 as any, right: 1 as any, bottom: 1 as any, left: 1 as any }, includeToc: true, displayHeaderFooter: true } },
        ai: {
          rewriteSelectionEnabled: true,
          rewriteProvider: 'openai-compatible',
          rewriteEndpoint: 'https://example.com/v1/chat/completions',
          rewriteModel: 'm',
          rewriteTimeoutMs: 5000,
        },
      };
      const secrets: Record<string, string | undefined> = { 'markly.ai.apiKey': 'sk-testkey123456789' };
      const r = await rewriteSelectionViaProvider('hello world', cfg, mockContext(secrets));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.text).toBe('Polished.');
      expect(fetchMock).toHaveBeenCalled();
      const [, init] = fetchMock.mock.calls[0];
      expect(String((init as any).headers?.authorization ?? '')).toContain('Bearer ');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

