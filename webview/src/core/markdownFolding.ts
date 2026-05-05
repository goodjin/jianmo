import type { EditorState } from '@codemirror/state';
import type { FoldRange } from '@codemirror/language';

function parseAtxHeading(lineText: string): { level: number } | null {
  const m = String(lineText ?? '').match(/^(#{1,6})\s+(.+)$/);
  if (!m) return null;
  return { level: m[1]!.length };
}

/**
 * M69：为 Markdown ATX 标题计算可折叠范围（折叠该标题下的正文，直到下一个同级或更高标题）。
 * 返回 null 表示该行不可折叠。
 */
export function computeMarkdownHeadingFoldRange(state: EditorState, lineStartPos: number): FoldRange | null {
  const doc = state.doc;
  const line = doc.lineAt(lineStartPos);
  const head = parseAtxHeading(line.text);
  if (!head) return null;

  const from = Math.min(doc.length, line.to);
  if (from >= doc.length) return null;

  let to = doc.length;
  for (let n = line.number + 1; n <= doc.lines; n++) {
    const next = doc.line(n);
    const nh = parseAtxHeading(next.text);
    if (!nh) continue;
    if (nh.level <= head.level) {
      to = next.from;
      break;
    }
  }

  if (to <= from + 1) return null;
  return { from, to };
}

