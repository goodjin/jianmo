import type { AssistResult, TitleSuggestion } from './assistTypes';

export function mapAssistTextResult(
  r: AssistResult<string>
): { ok: true; text: string } | { ok: false; error: string } {
  return r.ok ? { ok: true, text: r.data } : r;
}

export function mapAssistMarkdownResult(
  r: AssistResult<string>
): { ok: true; markdown: string } | { ok: false; error: string } {
  return r.ok ? { ok: true, markdown: r.data } : r;
}

export function mapAssistTitlesResult(
  r: AssistResult<TitleSuggestion[]>
): { ok: true; items: TitleSuggestion[] } | { ok: false; error: string } {
  return r.ok ? { ok: true, items: r.data } : r;
}
