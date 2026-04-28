export type WritingAssistAction = 'summarize' | 'suggestTitle' | 'fixMarkdown' | 'tidyTables';

function stripMarkdownSyntax(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildLocalSummary(markdown: string, maxChars = 140): string {
  const text = stripMarkdownSyntax(markdown);
  if (!text) return '> 摘要：当前文档还没有足够内容可摘要。\n\n';
  const sentence = text.split(/(?<=[。！？.!?])\s+/).find(Boolean) ?? text;
  const summary = sentence.length > maxChars ? `${sentence.slice(0, maxChars).trim()}...` : sentence;
  return `> 摘要：${summary}\n\n`;
}

export function suggestMarkdownTitle(markdown: string): string {
  const lines = markdown.split('\n');
  if (lines.some((line) => /^#\s+\S/.test(line))) return markdown;
  const firstMeaningful = lines.find((line) => stripMarkdownSyntax(line).length > 0) ?? '未命名文档';
  const title = stripMarkdownSyntax(firstMeaningful).slice(0, 40) || '未命名文档';
  return `# ${title}\n\n${markdown.trimStart()}`;
}

export function fixMarkdownWhitespace(markdown: string): string {
  const normalized = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${normalized}\n`;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function formatTableBlock(lines: string[]): string[] {
  const rows = lines.map(splitTableRow);
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_, idx) => row[idx] ?? ''));
  const colWidths = Array.from({ length: width }, (_, col) =>
    Math.max(3, ...normalizedRows.map((row) => row[col]!.length))
  );

  return normalizedRows.map((row, rowIndex) => {
    if (rowIndex === 1 && isTableSeparator(lines[rowIndex] ?? '')) {
      return `| ${colWidths.map((w) => '-'.repeat(w)).join(' | ')} |`;
    }
    return `| ${row.map((cell, col) => cell.padEnd(colWidths[col]!)).join(' | ')} |`;
  });
}

export function tidyMarkdownTables(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i] ?? '';
    const next = lines[i + 1] ?? '';
    if (current.includes('|') && isTableSeparator(next)) {
      const block = [current, next];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim()) {
        block.push(lines[i]!);
        i += 1;
      }
      i -= 1;
      out.push(...formatTableBlock(block));
    } else {
      out.push(current);
    }
  }
  return out.join('\n');
}

