/**
 * M80：写作辅助 Provider 快照与操作接口 — 不含 vscode/fetch，便于后续替换为多 provider 插件。
 */

export type AssistProviderId = 'none' | 'mock' | 'openai-compatible';

/** 与用户设置对齐的一帧配置（密钥不在此结构中） */
export interface AssistFeatureSnapshot {
  enabled: boolean;
  provider: AssistProviderId;
  endpoint: string;
  model: string;
  timeoutMs: number;
}

export type TitleSuggestion = { title: string; style: string; reason?: string };

export type AssistResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

/** 可被不同传输实现替换的核心能力契约 */
export interface AssistModelOperations {
  rewriteSelection(text: string): Promise<AssistResult<string>>;
  summarize(params: { text: string; scope: 'document' | 'section' }): Promise<AssistResult<string>>;
  suggestTitles(text: string): Promise<AssistResult<TitleSuggestion[]>>;
  convertTextToGfmTable(text: string): Promise<AssistResult<string>>;
}
