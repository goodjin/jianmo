/**
 * 图表装饰器单元测试
 * @module decorators/__tests__/diagram
 */

import { describe, it, expect, vi } from 'vitest';
import { diagramDecorator } from '../diagram';

vi.mock('@codemirror/view', () => ({
  ViewPlugin: {
    fromClass: vi.fn((classDef, spec) => ({
      extension: { type: 'viewPlugin', class: classDef, spec },
    })),
  },
  Decoration: {
    none: { type: 'none' },
    replace: vi.fn((spec) => ({
      type: 'replace',
      spec,
      range: vi.fn((from, to) => ({ from, to })),
    })),
    set: vi.fn((ranges) => ({ type: 'set', ranges })),
  },
  WidgetType: class WidgetType {
    eq() { return false; }
  },
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

describe('diagramDecorator', () => {
  it('应该创建图表装饰器', () => {
    const decorator = diagramDecorator();
    expect(decorator).toBeDefined();
    expect(decorator.extension).toBeDefined();
  });

  it('应该接受选项参数', () => {
    const decorator = diagramDecorator({ classPrefix: 'custom' });
    expect(decorator).toBeDefined();
  });

  it('装饰器应该有 extension 属性', () => {
    const decorator = diagramDecorator();
    expect(decorator).toHaveProperty('extension');
  });
});
