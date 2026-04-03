/**
 * 图表装饰器单元测试
 * @module core/decorators/__tests__/diagram
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@codemirror/view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codemirror/view')>();
  return {
    ...actual,
    WidgetType: class WidgetType {
      eq() { return false; }
    },
  };
});

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

import { diagramDecorator } from '../diagram';

describe('diagramDecorator', () => {
  it('应该创建图表装饰器（Extension）', () => {
    const ext = diagramDecorator();
    expect(ext).toBeDefined();
  });

  it('应该接受选项参数', () => {
    const ext = diagramDecorator({ classPrefix: 'custom' });
    expect(ext).toBeDefined();
  });
});
