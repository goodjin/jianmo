import { describe, expect, it } from 'vitest';
import { applySuggestedTitleToMarkdown } from '../titleSuggestions';

describe('applySuggestedTitleToMarkdown', () => {
  it('inserts a new H1 when no H1 exists', () => {
    const md = 'hello\n\nworld';
    const out = applySuggestedTitleToMarkdown(md, '我的标题');
    expect(out.startsWith('# 我的标题\n\n')).toBe(true);
    expect(out).toContain('hello');
  });

  it('replaces the first existing H1 text', () => {
    const md = '# Old\n\n## S\n\nx';
    const out = applySuggestedTitleToMarkdown(md, 'New');
    expect(out.split('\n')[0]).toBe('# New');
    expect(out).toContain('## S');
  });

  it('keeps markdown unchanged when title is blank', () => {
    const md = '# A\n\nb';
    expect(applySuggestedTitleToMarkdown(md, '   ')).toBe(md);
  });
});

