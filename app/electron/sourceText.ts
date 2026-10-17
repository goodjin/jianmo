/**
 * 桌面版「查看源码」要显示的文本。
 * Markdown 原样；JSON / JSONL 能解析就排成两空格缩进，解析不了就留下原文。
 * 纯函数：不碰界面、不改文件。
 */
import { structuredKindFromName } from './documentKind';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function prettyValue(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  return typeof text === 'string' ? text : '';
}

function prettyJson(source: string): string {
  try {
    return prettyValue(JSON.parse(source));
  } catch {
    return source;
  }
}

/** 每一行能解析就单独排开，行与行之间空一行。空行跳过。解析失败的那一行原样留下。 */
function prettyJsonl(source: string): string {
  const parts: string[] = [];
  for (const raw of source.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    try {
      parts.push(prettyValue(JSON.parse(raw)));
    } catch {
      parts.push(raw);
    }
  }
  if (parts.length === 0) return source;
  return parts.join('\n\n');
}

/** 按文件名决定怎么排。路径里带目录也行。 */
export function formatDocumentSource(content: string, fileName: string): string {
  const source = String(content ?? '');
  const kind = structuredKindFromName(fileName);
  if (kind === 'json') return prettyJson(stripBom(source));
  if (kind === 'jsonl') return prettyJsonl(stripBom(source));
  return source;
}

/**
 * JSON / JSONL 排不成缩进时给一句说明。Markdown 不需要这句。
 * 能排的不说话，避免源码上方多一块字。
 */
export function sourceFormatNote(content: string, fileName: string): string {
  const kind = structuredKindFromName(fileName);
  if (!kind) return '';
  const source = stripBom(String(content ?? ''));
  if (kind === 'json') {
    try {
      JSON.parse(source);
      return '';
    } catch {
      return '这份 JSON 没法排成缩进，下面是原文。';
    }
  }
  let good = 0;
  let bad = 0;
  for (const raw of source.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    try {
      JSON.parse(raw);
      good += 1;
    } catch {
      bad += 1;
    }
  }
  if (bad === 0) return '';
  if (good === 0) return '这些行没法排成缩进，下面是原文。';
  return '有的行没法排成缩进，那些行按原文留下。';
}
