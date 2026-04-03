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

/**
 * 在全文范围内找出所有非重叠匹配（全局正则）。
 */
export function findAllMatchesInText(text: string, re: RegExp): TextMatch[] {
  const out: TextMatch[] = [];
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push({ from: m.index, to: m.index + m[0].length });
    if (m[0].length === 0) {
      r.lastIndex++;
    }
  }
  return out;
}
