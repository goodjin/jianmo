/**
 * 独立应用能打开的文档类型。Markdown 走原来的预览；JSON / JSONL 走圆角框渲染。
 * 只看文件名，不读内容。
 */
import { isMarkdownFileName } from './recentFiles';

export type StructuredKind = 'json' | 'jsonl';

/** 从文件名或完整路径判断是不是 JSON / JSONL。先认 `.jsonl`，避免被 `.json` 前缀吃掉。 */
export function structuredKindFromName(name: string): StructuredKind | null {
  const base = String(name ?? '').split(/[/\\]/).pop() ?? '';
  const lower = base.toLowerCase();
  if (lower.endsWith('.jsonl')) return 'jsonl';
  if (lower.endsWith('.json')) return 'json';
  return null;
}

/** Markdown、JSON、JSONL 都可以从对话框、目录树、拖拽里打开。 */
export function isOpenableDocumentName(name: string): boolean {
  return isMarkdownFileName(name) || structuredKindFromName(name) !== null;
}
