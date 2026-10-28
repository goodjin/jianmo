import { describe, expect, it } from 'vitest';
import {
  MERMAID_OPEN,
  clampMermaidZoom,
  mermaidViewerRuntimeSource,
  readMermaidOpen,
} from './mermaidViewer';

describe('mermaidViewer', () => {
  it('缩放夹在 0.25–4', () => {
    expect(clampMermaidZoom(0.1)).toBe(0.25);
    expect(clampMermaidZoom(8)).toBe(4);
    expect(clampMermaidZoom(1.5)).toBe(1.5);
  });

  it('读出打开消息', () => {
    expect(readMermaidOpen({ type: MERMAID_OPEN, svg: '<svg></svg>', source: 'graph TD' })).toEqual({
      svg: '<svg></svg>',
      source: 'graph TD',
    });
    expect(readMermaidOpen({ type: 'other' })).toBeNull();
  });

  it('运行时含点击打开类型', () => {
    expect(mermaidViewerRuntimeSource()).toContain(MERMAID_OPEN);
  });
});
