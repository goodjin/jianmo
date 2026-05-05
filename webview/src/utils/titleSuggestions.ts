export function applySuggestedTitleToMarkdown(markdown: string, title: string): string {
  const t = String(title ?? '').trim();
  if (!t) return markdown;
  const md = String(markdown ?? '');

  const lines = md.split('\n');
  const firstHeadingIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (firstHeadingIdx >= 0) {
    lines[firstHeadingIdx] = `# ${t}`;
    return lines.join('\n');
  }

  const trimmed = md.trimStart();
  const prefix = `# ${t}\n\n`;
  return `${prefix}${trimmed}`;
}

