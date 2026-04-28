import { describe, expect, it } from 'vitest';
import {
  buildLocalSummary,
  fixMarkdownWhitespace,
  suggestMarkdownTitle,
  tidyMarkdownTables,
} from '../writingAssistant';

describe('writingAssistant local transforms', () => {
  it('builds a short blockquote summary from markdown prose', () => {
    const summary = buildLocalSummary('# Title\n\n第一段说明产品目标。第二段包含更多细节。');

    expect(summary).toContain('> 摘要：');
    expect(summary).toContain('第一段说明产品目标。');
    expect(summary).not.toContain('#');
  });

  it('adds a title only when the document does not already have one', () => {
    expect(suggestMarkdownTitle('第一段内容\n\nmore').startsWith('# 第一段内容')).toBe(true);
    expect(suggestMarkdownTitle('# Existing\n\nbody')).toBe('# Existing\n\nbody');
  });

  it('normalizes trailing spaces and excessive blank lines', () => {
    expect(fixMarkdownWhitespace('a  \n\n\n\nb\t')).toBe('a\n\nb\n');
  });

  it('tidies simple markdown tables without changing cell content', () => {
    const result = tidyMarkdownTables('|A|Long|\n|---|---|\n|1|two|');

    expect(result).toBe('| A   | Long |\n| --- | ---- |\n| 1   | two  |');
  });
});

