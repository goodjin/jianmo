import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { computeMarkdownHeadingFoldRange } from '../markdownFolding';

describe('computeMarkdownHeadingFoldRange (M69)', () => {
  it('folds content under a heading until next same-or-higher heading', () => {
    const md = ['# A', 'a1', '## A.1', 'x', '# B', 'b1'].join('\n');
    const st = EditorState.create({ doc: md });
    const aLine = st.doc.line(1);
    const r = computeMarkdownHeadingFoldRange(st, aLine.from);
    expect(r).not.toBe(null);
    // should end at start of '# B'
    const bLine = st.doc.line(5);
    expect(r?.to).toBe(bLine.from);
  });

  it('returns null for non-heading lines', () => {
    const st = EditorState.create({ doc: 'hello\nworld' });
    const line2 = st.doc.line(2);
    expect(computeMarkdownHeadingFoldRange(st, line2.from)).toBe(null);
  });
});

