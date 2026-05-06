/**
 * M42：与大纲面板对齐的 ```mermaid 围栏扫描（与扩展侧 `mermaidFenceUtils` 语义一致）。
 */
export const MERMAID_DIAGRAM_WEBVIEW_PREFIX = 'markly-diagram-';

export interface MermaidOutlineEntry {
  /** 与导出 DOM id：`markly-diagram-${index}` */
  readonly index: number;
  readonly id: string;
  /** 源码中的字符偏移（围栏起始行首） */
  readonly from: number;
  readonly line: number;
  readonly label: string;
}

export function parseMermaidOutlineEntries(markdown: string): MermaidOutlineEntry[] {
  const out: MermaidOutlineEntry[] = [];
  const lines = String(markdown ?? '').split('\n');
  let pos = 0;
  let i = 0;
  let fenceIdx = 0;

  while (i < lines.length) {
    const line = lines[i];
    const head = line.trim();
    if (/^```mermaid\b/.test(head)) {
      fenceIdx++;
      const startLine = i;
      const startPos = pos;

      let alt: string | undefined;
      let preview = '';
      let j = i + 1;
      for (; j < lines.length && lines[j].trim() !== '```'; j++) {
        const row = lines[j];
        const am = row.match(/^\s*%%\s*alt:\s*(.+)$/i);
        if (am) alt = am[1].trim();
        if (!preview && row.trim() && !/^\s*%%/.test(row)) {
          preview = row.trim().slice(0, 56);
        }
      }

      const label = (alt && alt.length ? alt : preview) || `图表 #${fenceIdx}`;
      out.push({
        index: fenceIdx,
        id: `${MERMAID_DIAGRAM_WEBVIEW_PREFIX}${fenceIdx}`,
        from: startPos,
        line: startLine,
        label,
      });

      for (let k = i; k <= j && k < lines.length; k++) {
        pos += lines[k].length + 1;
      }
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }

    pos += line.length + 1;
    i++;
  }

  return out;
}
