/**
 * M75：本地 Markdown 结构修复（二期）——列表 / 空行 / 标题层级。
 * 约定：fenced code（``` / ~~~ …）内不改，避免破坏示例。
 */

/** 标准 ATX 标题：至多 3 行前导空格，`#…#` + 空格 + 标题，或仅 `#…`（无正文） */
export function looksLikeAtxHeadingLine(line: string): boolean {
  const full = line.trimEnd();
  return /^(\t|[ \t]{0,3})#{1,6}(?:\s+.*|)$/.test(full);
}

function isFenceDelimiter(line: string): boolean {
  const t = line.trimEnd();
  return /^ {0,3}(`{3,}|~{3,})/.test(t);
}

/** 无序 / 有序列表或引用；与标题紧贴时不强制插空行 */
function isListOrQuoteLine(line: string): boolean {
  const t = line.trimEnd();
  if (!t.trim()) return false;
  if (/^(\t|[ \t]{0,3})([-*+]|\d{1,9}\.)[\t ]/.test(t)) return true;
  return /^(\t|[ \t]{0,3})>/.test(t);
}

function normalizeUnorderedBullet(line: string): string {
  return line.replace(/^(\t| *)\*([\t ]+)/, '$1-$2').replace(/^(\t| *)\+([\t ]+)/, '$1-$2');
}

function normalizeTaskCheckbox(line: string): string {
  return line
    .replace(/^(\t| *)-\s*\[\s*[xX]\s*]/, '$1- [x]')
    .replace(/^(\t| *)-\s*\[\s*]\s*/, '$1- [ ] ');
}

/**
 * @returns repaired line, or null if not ATX heading
 */
function repairAtxHeadingLine(line: string, lastHeadingLevel: number | null): { next: string; level: number } | null {
  const full = line.trimEnd();
  const m = /^(\t|[ \t]{0,3})(#{1,6})(?:\s(.*)|)$/.exec(full);
  if (!m) return null;

  const indent = m[1] ?? '';
  let level = m[2].length;
  let rest = (m[3] ?? '').trim();
  if (rest.endsWith('#')) {
    const inner = /^(.+?)(?:[\t ]+#+[\t ]*)$/.exec(rest);
    if (inner) rest = inner[1]!.trimEnd();
  }

  let adjusted = level;
  if (lastHeadingLevel !== null && adjusted > lastHeadingLevel + 1) {
    adjusted = lastHeadingLevel + 1;
  }
  const hashes = '#'.repeat(adjusted);

  /** 形如 `######`（无空格）已通过 `(?:\\s(.*)|)$` 将 rest 放空 */
  let title: string;
  if (!rest.trim()) title = `${indent}${hashes}`;
  else title = `${indent}${hashes} ${rest.replace(/^\s+/, '')}`;
  return { next: title, level: adjusted };
}

function passStructuralPerLine(lines: readonly string[]): string[] {
  let inFence = false;
  let lastHeadingLevel: number | null = null;
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw ?? '';
    if (isFenceDelimiter(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    let working = normalizeTaskCheckbox(normalizeUnorderedBullet(line));

    if (!looksLikeAtxHeadingLine(working)) {
      out.push(working);
      continue;
    }

    const repaired = repairAtxHeadingLine(working, lastHeadingLevel);
    if (!repaired) {
      out.push(working);
      continue;
    }
    lastHeadingLevel = repaired.level;

    const prev = out.length ? out[out.length - 1] : undefined;
    if (
      prev !== undefined &&
      prev.trim() !== '' &&
      !looksLikeAtxHeadingLine(prev) &&
      !isListOrQuoteLine(prev)
    ) {
      out.push('');
    }

    out.push(repaired.next);
  }

  return out;
}

/** 标题后若直接接段落（非法定列表/引用/标题），补一空行（避免已有空行时再插一层） */
function passBlankAfterHeadings(lines: readonly string[]): string[] {
  let inFence = false;
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw ?? '';
    if (isFenceDelimiter(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const last = out.length ? out[out.length - 1] : undefined;
    if (
      last !== undefined &&
      looksLikeAtxHeadingLine(last) &&
      line.trim() !== '' &&
      !looksLikeAtxHeadingLine(line) &&
      !isListOrQuoteLine(line)
    ) {
      out.push('');
    }
    out.push(line);
  }

  return out;
}

export function repairMarkdownStructureM75(markdown: string): string {
  const text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text) return text;
  const split = text.split('\n');
  return passBlankAfterHeadings(passStructuralPerLine(split)).join('\n');
}
