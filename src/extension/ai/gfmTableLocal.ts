/**
 * GFM 表格纯本地逻辑（无 Provider / 无网络），供 mock 与校验复用。
 */

export function escapeGfmCell(cell: string): string {
  return cell
    .replace(/\r?\n/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');
}

export function rowsFromTsv(block: string): string[][] | null {
  const lines = block
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2 || !/\t/.test(block)) return null;
  const rows = lines.map((line) => line.split('\t').map((c) => c.trim()));
  const w = rows[0]!.length;
  if (w < 2 || !rows.every((r) => r.length === w)) return null;
  return rows;
}

/** 极简 CSV（无引号逃逸）：各行逗号分列数完全一致且 ≥2 */
export function rowsFromSimpleCsv(block: string): string[][] | null {
  if (/\t/.test(block)) return null;
  const lines = block
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const rows = lines.map((line) => line.split(',').map((c) => c.trim()));
  const w = rows[0]!.length;
  if (w < 2 || !rows.every((r) => r.length === w)) return null;
  return rows;
}

export function buildGfmMarkdownTable(rows: string[][]): string {
  const escaped = rows.map((r) => r.map((c) => escapeGfmCell(c)));
  const colCount = Math.max(...escaped.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array.from({ length: Math.max(0, colCount - r.length) }, () => '')];
  const fmt = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const padded = escaped.map(pad);
  const sep = Array.from({ length: colCount }, () => '---');
  const out: string[] = [fmt(padded[0]!), fmt(sep)];
  for (let i = 1; i < padded.length; i += 1) {
    out.push(fmt(padded[i]!));
  }
  return `${out.join('\n')}\n`;
}

/** mock / 本地：优先 TSV，其次齐列逗号表 */
export function tryMockConvertDelimitedTextToGfmTable(raw: string): string | null {
  const t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!t.trim()) return null;
  const tsvRows = /\t/.test(t) ? rowsFromTsv(t) : null;
  const csvRows = tsvRows ?? rowsFromSimpleCsv(t);
  if (!csvRows) return null;
  return buildGfmMarkdownTable(csvRows);
}

/** 剥离一层 markdown / tilde 围栏 */
export function unwrapMarkdownFence(text: string): string {
  const t = text.trim();
  const bt = '`'.repeat(3);
  const reMd = new RegExp(
    '^' + bt + '(?:markdown|md|gfm)?\\s*\\r?\\n([\\s\\S]*?)\\r?\\n' + bt + '\\s*$',
    'm'
  );
  const reTilde = new RegExp('^~~~(?:markdown|md)?\\s*\\r?\\n([\\s\\S]*?)\\r?\\n~~~\\s*$', 'm');
  const fenced = reMd.exec(t) ?? reTilde.exec(t);
  return fenced?.[1] != null ? String(fenced[1]).trim() : t;
}

function isMarkdownTableSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes('|') || !t.includes('-')) return false;
  const inner = t.replace(/^\|/, '').replace(/\|$/, '').trim();
  if (!inner) return false;
  const parts = inner.split('|').map((p) => p.trim());
  if (parts.length < 2) return false;
  return parts.every((p) => /^:?-{3,}:?$/.test(p));
}

export function looksLikeGfmTable(markdown: string): boolean {
  const body = unwrapMarkdownFence(markdown);
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2 || !lines.some((ln) => ln.includes('|'))) return false;
  return lines.some((ln) => isMarkdownTableSeparatorRow(ln));
}
