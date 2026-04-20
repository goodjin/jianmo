/**
 * 查找模式：字面量 / 通配符 (* ?) / 正则
 */

export type FindPatternMode = 'literal' | 'glob' | 'regex';

export interface FindPatternOptions {
  caseSensitive: boolean;
  patternMode: FindPatternMode;
  /** 全字匹配：普通/通配符用 Unicode \\b；正则模式用 \\p 字类边界，避免与用户写的 \\b 冲突 */
  wholeWord?: boolean;
}

function globToRegexSource(globPattern: string): string {
  let out = '';
  for (const c of globPattern) {
    if (c === '*') {
      // 非贪婪，便于在一次查找中接连匹配多段（如 p*g 对应每个 ping）
      out += '.*?';
    } else if (c === '?') {
      out += '.';
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return out;
}

/**
 * 将查找框内容转为用于匹配的正则；无效正则返回 null。
 */
export function patternToRegExp(
  pattern: string,
  options: FindPatternOptions
): RegExp | null {
  if (!pattern) return null;
  let flags = options.caseSensitive ? 'g' : 'gi';
  try {
    let inner: string;
    if (options.patternMode === 'regex') {
      inner = pattern;
    } else if (options.patternMode === 'glob') {
      inner = globToRegexSource(pattern);
    } else {
      inner = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (options.wholeWord) {
      if (options.patternMode === 'regex') {
        inner = `(?<![\\p{L}\\p{N}_])(?:${inner})(?![\\p{L}\\p{N}_])`;
      } else {
        inner = `\\b(?:${inner})\\b`;
      }
      if (!flags.includes('u')) {
        flags += 'u';
      }
    }

    return new RegExp(inner, flags);
  } catch {
    return null;
  }
}

export interface TextMatch {
  from: number;
  to: number;
}

export interface FindAllMatchesResult {
  matches: TextMatch[];
  /** 达到 maxResults 上限提前停止时为 true */
  truncated: boolean;
}

/**
 * 在全文范围内找出所有非重叠匹配（全局正则）。
 * @param maxResults 可选上限，避免超大文档 + 高频匹配时数组与 GC 压力（查找「全部替换」仍应对整篇单独处理）
 */
export function findAllMatchesInText(
  text: string,
  re: RegExp,
  maxResults?: number
): FindAllMatchesResult {
  const out: TextMatch[] = [];
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  const cap = maxResults ?? Number.POSITIVE_INFINITY;
  while ((m = r.exec(text)) !== null) {
    out.push({ from: m.index, to: m.index + m[0].length });
    if (out.length >= cap) {
      return { matches: out, truncated: true };
    }
    if (m[0].length === 0) {
      r.lastIndex++;
    }
  }
  return { matches: out, truncated: false };
}

/**
 * 第一个满足 `from > afterPos` 的匹配；若无且 `wrap` 则回绕到全文第一个匹配。
 * 用于截断列表外的「查找下一个」导航，语义与数组 `findIndex(m => m.from > pos)` + 回绕一致。
 */
export function findFirstMatchAfter(
  text: string,
  re: RegExp,
  afterPos: number,
  wrap: boolean
): TextMatch | null {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m.index > afterPos) {
      return { from: m.index, to: m.index + m[0].length };
    }
    if (m[0].length === 0) {
      r.lastIndex++;
    }
  }
  if (!wrap) return null;
  const r2 = new RegExp(re.source, flags);
  let m2: RegExpExecArray | null;
  while ((m2 = r2.exec(text)) !== null) {
    return { from: m2.index, to: m2.index + m2[0].length };
  }
  return null;
}

/**
 * 最后一个满足 `to < beforePos` 的匹配；若无且 `wrap` 则回绕到全文最后一个匹配。
 * 语义与从后往前找 `to < pos` + 回绕一致。
 */
export function findLastMatchBefore(
  text: string,
  re: RegExp,
  beforePos: number,
  wrap: boolean
): TextMatch | null {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let lastBefore: TextMatch | null = null;
  let lastAny: TextMatch | null = null;
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    const from = m.index;
    const to = m.index + m[0].length;
    const match: TextMatch = { from, to };
    lastAny = match;
    if (to < beforePos) {
      lastBefore = match;
    }
    if (m[0].length === 0) {
      r.lastIndex++;
    }
  }
  if (lastBefore) return lastBefore;
  return wrap ? lastAny : null;
}

/**
 * 与 {@link findAllMatchesInText} 相同的扫描顺序下，目标区间是第几个匹配（从 0 起）。
 * 用于 Rich（Milkdown）在「扁平文本」里按序定位第 n 次出现的匹配文本。
 */
export function matchOrdinalInText(text: string, re: RegExp, target: TextMatch): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let ord = 0;
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    const from = m.index;
    const to = m.index + m[0].length;
    if (from === target.from && to === target.to) return ord;
    ord++;
    if (m[0].length === 0) {
      r.lastIndex++;
    }
  }
  return 0;
}
