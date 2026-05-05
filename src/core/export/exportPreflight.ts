/**
 * M83：导出前静态检查（缺失本地图、缺失本地链、疑似未闭合的 $/$$ 公式分隔符）。
 */
import * as fs from 'fs';
import type { ExportPreflightScope } from '@types';
import { extractMarkdownLocalImageRefs, resolveMarkdownImageFsPath } from '@core/markdown/markdownImageRefs';
import { extractMarkdownLinkHrefs, resolveMarkdownHrefToFsPath } from '@core/markdown/markdownLinkRefs';

export type { ExportPreflightScope } from '@types';

export type ExportPreflightIssueKind = 'missing_image' | 'broken_math' | 'missing_local_link';

export interface ExportPreflightIssue {
  kind: ExportPreflightIssueKind;
  message: string;
  ref?: string;
  resolvedPath?: string;
}

/** 去掉围栏代码块与 HTML 注释，便于粗查公式分隔符（非完整 Markdown 语法树）。 */
export function stripFencedCodeAndHtmlCommentsForMathScan(markdown: string): string {
  let s = String(markdown ?? '');
  s = s.replace(/^```[\w-]*\n[\s\S]*?^```\s*/gm, '\n');
  s = s.replace(/^~~~[\w-]*\n[\s\S]*?^~~~\s*/gm, '\n');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  return s;
}

/**
 * 粗检 `$$` 与 `$` 是否成对（忽略围栏代码块内内容之后）。
 * 不解析嵌套 LaTeX，仅作导出前风险提示。
 */
export function detectBrokenMathDelimiters(markdown: string): string | undefined {
  const text = stripFencedCodeAndHtmlCommentsForMathScan(markdown);
  const inlineCodeStripped = text.replace(/`[^`\n]+`/g, '');
  const dbl = (inlineCodeStripped.match(/\$\$/g) ?? []).length;
  if (dbl % 2 === 1) return '公式块 $$ 未闭合（分隔符数量为奇数）';

  let withoutBlockMath = inlineCodeStripped.replace(/\$\$[\s\S]*?\$\$/g, '');
  let singles = 0;
  for (let i = 0; i < withoutBlockMath.length; i++) {
    const ch = withoutBlockMath[i];
    if (ch !== '$') continue;
    if (withoutBlockMath[i + 1] === '$') {
      i++;
      continue;
    }
    if (i > 0 && withoutBlockMath[i - 1] === '\\') continue;
    singles++;
  }
  if (singles % 2 === 1) return '行内公式 $ 可能未配对';
  return undefined;
}

export function analyzeMarkdownExportPreflight(options: {
  markdown: string;
  sourceFileFsPath: string;
  workspaceRootFsPath: string;
  scope: ExportPreflightScope;
  existsSync?: (p: string) => boolean;
}): ExportPreflightIssue[] {
  const exists = options.existsSync ?? fs.existsSync;
  const issues: ExportPreflightIssue[] = [];
  if (options.scope === 'off') return issues;

  const { markdown, sourceFileFsPath, workspaceRootFsPath } = options;

  if (options.scope === 'full') {
    const math = detectBrokenMathDelimiters(markdown);
    if (math) {
      issues.push({ kind: 'broken_math', message: math });
    }
  }

  if (options.scope === 'images' || options.scope === 'full') {
    const refs = extractMarkdownLocalImageRefs(markdown);
    const seen = new Set<string>();
    for (const ref of refs) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      const p = resolveMarkdownImageFsPath(sourceFileFsPath, ref);
      if (!p) continue;
      if (!exists(p)) {
        issues.push({
          kind: 'missing_image',
          message: `本地图片未找到: ${ref}`,
          ref,
          resolvedPath: p,
        });
      }
    }
  }

  if (options.scope === 'full') {
    const hrefs = extractMarkdownLinkHrefs(markdown);
    const seenL = new Set<string>();
    for (const href of hrefs) {
      if (seenL.has(href)) continue;
      seenL.add(href);
      const p = resolveMarkdownHrefToFsPath({
        sourceFileFsPath,
        workspaceRootFsPath,
        href,
      });
      if (!p) continue;
      if (!exists(p)) {
        issues.push({
          kind: 'missing_local_link',
          message: `本地链接目标不存在: ${href}`,
          ref: href,
          resolvedPath: p,
        });
      }
    }
  }

  return issues;
}
