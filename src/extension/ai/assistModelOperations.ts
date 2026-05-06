/**
 * M80：根据快照 + 凭证依赖构造统一的 AssistModelOperations（mock / none / openai-compatible）。
 */

import {
  looksLikeGfmTable,
  tryMockConvertDelimitedTextToGfmTable,
  unwrapMarkdownFence,
} from './gfmTableLocal';
import { openAiCompatibleChatCompletion, type ChatCompletionMessage } from './openAiCompatibleTransport';
import type {
  AssistFeatureSnapshot,
  AssistModelOperations,
  AssistResult,
  TitleSuggestion,
} from './assistTypes';

export interface AssistRuntimeDeps {
  getBearerToken: () => Promise<string | undefined>;
  fetchFn?: typeof fetch;
}

function fail<T>(error: string): AssistResult<T> {
  return { ok: false, error };
}

function ok<T>(data: T): AssistResult<T> {
  return { ok: true, data };
}

function disabledOps(): AssistModelOperations {
  return {
    rewriteSelection: async () => fail('rewriteSelection 未启用（markly.ai.rewrite.enabled=false）'),
    summarize: async () => fail('AI 未启用（markly.ai.rewrite.enabled=false）'),
    suggestTitles: async () => fail('AI 未启用（markly.ai.rewrite.enabled=false）'),
    convertTextToGfmTable: async () => fail('AI 未启用（markly.ai.rewrite.enabled=false）'),
  };
}

function noneOps(): AssistModelOperations {
  return {
    rewriteSelection: async () => fail('rewrite provider=none'),
    summarize: async () => fail('AI provider=none'),
    suggestTitles: async () => fail('AI provider=none'),
    convertTextToGfmTable: async () => fail('AI provider=none'),
  };
}

const mockOps: AssistModelOperations = {
  async rewriteSelection(text: string) {
    const s = String(text ?? '').trim();
    const first = s.charAt(0).toUpperCase() + s.slice(1);
    const out = /[。！？.!?]$/.test(first) ? first : `${first}.`;
    return ok(out);
  },

  async summarize(input: { text: string; scope: 'document' | 'section' }) {
    const raw = String(input.text ?? '');
    const firstLine = raw.trim().split('\n').find((l) => l.trim()) ?? '';
    const head = firstLine.slice(0, 40);
    const body =
      input.scope === 'section'
        ? `- 小结：${head}${head.length >= 40 ? '…' : ''}\n- 要点：……（mock）`
        : `- 摘要：${head}${head.length >= 40 ? '…' : ''}\n- 要点：……（mock）`;
    return ok(body);
  },

  async suggestTitles(text: string) {
    const input = String(text ?? '');
    const head = input.trim().split('\n').find((l) => l.trim())?.trim() ?? '未命名文档';
    const base = head.replace(/^#+\s+/, '').slice(0, 30) || '未命名文档';
    const items: TitleSuggestion[] = [
      { title: base, style: '简洁', reason: '提取首段关键词，适合笔记命名。' },
      { title: `关于 ${base} 的要点整理`, style: '叙述', reason: '更像文章标题，强调内容范围。' },
      { title: `${base}：实践清单与结论`, style: '学术', reason: '突出结构与结论，适合复盘/报告。' },
    ];
    return ok(items);
  },

  async convertTextToGfmTable(text: string) {
    const raw = String(text ?? '');
    const table = tryMockConvertDelimitedTextToGfmTable(raw);
    if (!table) {
      return fail(
        'mock：仅能将「制表符分隔（TSV）」或「每行列数一致的逗号表」转成 GFM；请打开 openai-compatible 获得通用转换。'
      );
    }
    return ok(table);
  },
};

class OpenAiCompatAssistModelOperations implements AssistModelOperations {
  constructor(
    private readonly snap: AssistFeatureSnapshot,
    private readonly deps: AssistRuntimeDeps
  ) {}

  private async chatRaw(params: {
    messages: ChatCompletionMessage[];
    temperature: number;
    responseFormatJsonObject?: boolean;
  }): Promise<AssistResult<string>> {
    const endpoint = this.snap.endpoint.trim();
    if (!endpoint) return fail('rewrite.endpoint 为空');
    const bearer = (await this.deps.getBearerToken())?.trim();
    if (!bearer) return fail('未设置 API Key（运行 “AI: Set API Key”）');

    const r = await openAiCompatibleChatCompletion({
      endpoint,
      model: this.snap.model,
      timeoutMs: this.snap.timeoutMs,
      bearerToken: bearer,
      messages: params.messages,
      temperature: params.temperature,
      responseFormatJsonObject: params.responseFormatJsonObject,
      fetchFn: this.deps.fetchFn,
    });
    if (!r.ok) return fail(r.error);
    const c = r.content.trim();
    if (!c) return fail('AI 返回空内容');
    return ok(c);
  }

  async rewriteSelection(text: string): Promise<AssistResult<string>> {
    const input = String(text ?? '');
    return this.chatRaw({
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'Rewrite the user text to be clearer and more polished. Keep meaning. Output only rewritten text.',
        },
        { role: 'user', content: input },
      ],
    });
  }

  async summarize(input: { text: string; scope: 'document' | 'section' }): Promise<AssistResult<string>> {
    const raw = String(input.text ?? '');
    const scopeHint = input.scope === 'section' ? 'section' : 'document';
    return this.chatRaw({
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a writing assistant. Summarize the given markdown content in Chinese. ' +
            'Output markdown only. Keep it short and structured. Include bullet points and, if helpful, a 1-line title.',
        },
        { role: 'user', content: `Scope=${scopeHint}\n\n${raw}` },
      ],
    });
  }

  async suggestTitles(text: string): Promise<AssistResult<TitleSuggestion[]>> {
    const input = String(text ?? '');
    const r = await this.chatRaw({
      temperature: 0.4,
      responseFormatJsonObject: true,
      messages: [
        {
          role: 'system',
          content:
            'You generate markdown titles. Output strict JSON only. ' +
            'Return 5 candidates in Chinese. Each item: {title, style, reason}. ' +
            'Styles should be diverse (e.g. 简洁/叙述/学术/教程/复盘). ' +
            'Titles should be <= 30 Chinese characters where possible.',
        },
        { role: 'user', content: input.slice(0, 6000) },
      ],
    });
    if (!r.ok) return r;
    try {
      const root = JSON.parse(r.data) as unknown;
      const rawList = Array.isArray(root) ? root : (root as { items?: unknown })?.items;
      const list = Array.isArray(rawList) ? rawList : [];
      const items: TitleSuggestion[] = (list as any[])
        .map((x) => ({
          title: String(x?.title ?? '').trim(),
          style: String(x?.style ?? '').trim(),
          reason: x?.reason != null ? String(x.reason).trim() : undefined,
        }))
        .filter((x) => x.title && x.style)
        .slice(0, 7);
      if (!items.length) return fail('AI 返回无有效候选');
      return ok(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(`AI 返回解析失败：${msg}`);
    }
  }

  async convertTextToGfmTable(text: string): Promise<AssistResult<string>> {
    const trimmed = String(text ?? '').trim();
    const r = await this.chatRaw({
      temperature: 0.1,
      responseFormatJsonObject: true,
      messages: [
        {
          role: 'system',
          content:
            'Convert user text into ONE GitHub-Flavored Markdown table only. ' +
            'The user text may be TSV/CSV-ish, aligned columns with multiple spaces, or plain Chinese/English descriptions that imply rows/cols. ' +
            'Respond with JSON ONLY: {"markdown":"..."} where markdown is ONLY the pipe table (+ optional leading/trailing newline), no fenced code fences, no extra keys.',
        },
        { role: 'user', content: trimmed.slice(0, 12_000) },
      ],
    });
    if (!r.ok) return r;
    let md = '';
    try {
      const parsed = JSON.parse(r.data) as { markdown?: unknown };
      md = String(parsed.markdown ?? '').trim();
    } catch {
      md = unwrapMarkdownFence(r.data);
    }
    md = unwrapMarkdownFence(md).trim();
    if (!md) return fail('AI 返回表格为空');
    if (!looksLikeGfmTable(md)) {
      return fail('AI 返回的不是可识别的 GFM 表格（未包含 |- 分隔行）');
    }
    const out = md.endsWith('\n') ? md : `${md}\n`;
    return ok(out);
  }
}

export function createAssistModelOperations(
  snap: AssistFeatureSnapshot,
  deps: AssistRuntimeDeps
): AssistModelOperations {
  if (!snap.enabled) return disabledOps();
  if (snap.provider === 'none') return noneOps();
  if (snap.provider === 'mock') return mockOps;
  // M169：避免误触并发狂发请求（最小防护：同一时刻只允许 1 个 in-flight 请求）
  const inner = new OpenAiCompatAssistModelOperations(snap, deps);
  let inFlight = 0;
  const guard = async <T>(fn: () => Promise<AssistResult<T>>): Promise<AssistResult<T>> => {
    if (inFlight >= 1) {
      return {
          ok: false,
          error: 'AI：上一条请求尚未结束，请等待完成后再试（防误触连发）。',
        };
    }
    inFlight++;
    try {
      return await fn();
    } finally {
      inFlight = Math.max(0, inFlight - 1);
    }
  };
  return {
    rewriteSelection: (t) => guard(() => inner.rewriteSelection(t)),
    summarize: (i) => guard(() => inner.summarize(i)),
    suggestTitles: (t) => guard(() => inner.suggestTitles(t)),
    convertTextToGfmTable: (t) => guard(() => inner.convertTextToGfmTable(t)),
  };
}
