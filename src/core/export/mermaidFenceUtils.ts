/**
 * M42/M43：扫描 Markdown 中的 ```mermaid 围栏（顺序与导出 transform 一致）。
 */

export const MERMAID_DIAGRAM_ID_PREFIX = 'markly-diagram-';

export function marklyDiagramDomId(index1: number): string {
  return `${MERMAID_DIAGRAM_ID_PREFIX}${index1}`;
}

/** 每个围栏内第一条 `%% alt: 描述`（大小写不敏感），无则 undefined */
export function orderedMermaidFenceAlts(markdown: string): (string | undefined)[] {
  const alts: (string | undefined)[] = [];
  const lines = String(markdown ?? '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const head = lines[i].trim();
    if (/^```mermaid\b/.test(head)) {
      let alt: string | undefined;
      let j = i + 1;
      for (; j < lines.length && lines[j].trim() !== '```'; j++) {
        const m = lines[j].match(/^\s*%%\s*alt:\s*(.+)$/i);
        if (m) {
          alt = m[1].trim();
          break;
        }
      }
      alts.push(alt);
      while (j < lines.length && lines[j].trim() !== '```') j++;
      i = j < lines.length ? j + 1 : lines.length;
      continue;
    }
    i++;
  }
  return alts;
}

export function buildDiagramTocAnchors(markdown: string): { anchor: string; label: string }[] {
  const alts = orderedMermaidFenceAlts(markdown);
  return alts.map((alt, ix) => ({
    anchor: marklyDiagramDomId(ix + 1),
    label: alt?.length ? alt : `图表 #${ix + 1}`,
  }));
}
