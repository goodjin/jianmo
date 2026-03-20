import { describe, it, expect } from 'vitest';
import {
  generateHeadingId,
  extractHeadings,
  generateTocMarkdown,
  hasToc,
  updateTocInContent,
  TOC_PLACEHOLDER
} from '../toc';

describe('TOC Utilities', () => {
  describe('generateHeadingId', () => {
    it('should convert to lowercase and replace spaces with hyphens', () => {
      expect(generateHeadingId('Hello World')).toBe('hello-world');
    });

    it('should keep chinese characters', () => {
      expect(generateHeadingId('你好 World')).toBe('你好-world');
    });

    it('should remove special characters but keep hyphens', () => {
      expect(generateHeadingId('Hello @ World!')).toBe('hello-world');
      expect(generateHeadingId('Hello-World')).toBe('hello-world');
    });

    it('should handle multiple consecutive spaces or hyphens', () => {
      expect(generateHeadingId('Hello   World')).toBe('hello-world');
      expect(generateHeadingId('Hello---World')).toBe('hello-world');
    });

    it('should trim trailing and leading hyphens', () => {
      expect(generateHeadingId('  Hello World  ')).toBe('hello-world');
      expect(generateHeadingId('-Hello-')).toBe('hello');
    });
  });

  describe('extractHeadings', () => {
    it('should extract standard ATX headings', () => {
      const markdown = `
# Heading 1
Some text
## Heading 2
### Heading 3
      `;
      const headings = extractHeadings(markdown);
      expect(headings).toHaveLength(3);
      expect(headings[0]).toEqual({ level: 1, text: 'Heading 1', id: 'heading-1' });
      expect(headings[1]).toEqual({ level: 2, text: 'Heading 2', id: 'heading-2' });
      expect(headings[2]).toEqual({ level: 3, text: 'Heading 3', id: 'heading-3' });
    });

    it('should ignore headings inside code blocks', () => {
      const markdown = `
# Real Heading
\`\`\`markdown
# Fake Heading
\`\`\`
## Another Real Heading
      `;
      const headings = extractHeadings(markdown);
      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Real Heading');
      expect(headings[1].text).toBe('Another Real Heading');
    });

    it('should strip existing custom IDs from heading text', () => {
      const markdown = '# My Title {#custom-id}';
      const headings = extractHeadings(markdown);
      expect(headings[0].text).toBe('My Title');
      // Notice: generateHeadingId generates ID from the text, it currently doesn't preserve the {#custom-id} in the AST
      // but it does strip it from the display text correctly
      expect(headings[0].id).toBe('my-title');
    });
  });

  describe('generateTocMarkdown', () => {
    it('should generate nested list based on levels', () => {
      const headings = [
        { level: 1, text: 'H1', id: 'h1' },
        { level: 2, text: 'H2', id: 'h2' },
        { level: 3, text: 'H3', id: 'h3' },
        { level: 2, text: 'H2 B', id: 'h2-b' }
      ];

      const toc = generateTocMarkdown(headings);
      expect(toc).toContain('- [H1](#h1)');
      expect(toc).toContain('  - [H2](#h2)');
      expect(toc).toContain('    - [H3](#h3)');
      expect(toc).toContain('  - [H2 B](#h2-b)');
      expect(toc).toContain('<!-- TOC -->');
      expect(toc).toContain('<!-- /TOC -->');
    });

    it('should handle empty headings gracefully', () => {
      const toc = generateTocMarkdown([]);
      expect(toc).toContain('<!-- TOC -->\n<!-- /TOC -->');
    });
  });

  describe('hasToc and updateTocInContent', () => {
    it('should detect standard TOC placeholder', () => {
      expect(hasToc('Some text\n<!-- TOC -->\nMore text')).toBe(true);
      expect(hasToc('Some text\n<!--TOC-->\nMore text')).toBe(true);
      expect(hasToc('Some text\n<!-- /TOC -->\nMore text')).toBe(false);
    });

    it('should replace placeholder with actual TOC', () => {
      const markdown = `
# Title

<!-- TOC -->

## Section 1
      `;
      const updated = updateTocInContent(markdown);
      expect(updated).toContain('## Table of Contents');
      expect(updated).toContain('- [Section 1](#section-1)');
      expect(updated).toContain('<!-- /TOC -->');
      expect(updated).toContain('## Section 1'); // Original content remains
    });

    it('should update existing populated TOC', () => {
      const markdown = `
# Title

<!-- TOC -->
## Table of Contents
- [Old Section](#old-section)
<!-- /TOC -->

## New Section
      `;
      const updated = updateTocInContent(markdown);
      expect(updated).toContain('- [New Section](#new-section)');
      expect(updated).not.toContain('Old Section');
    });

    it('should return original markdown if no TOC placeholder exists', () => {
      const markdown = '# Title\n\n## Section 1';
      const updated = updateTocInContent(markdown);
      expect(updated).toBe(markdown);
    });
  });
});
