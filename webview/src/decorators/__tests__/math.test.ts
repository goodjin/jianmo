/**
 * 数学公式装饰器单元测试
 * @module decorators/__tests__/math
 */

import { describe, it, expect, vi } from 'vitest';
import { mathDecorator } from '../math';

vi.mock('@codemirror/view', () => ({
  ViewPlugin: {
    fromClass: vi.fn((classDef, spec) => ({
      extension: { type: 'viewPlugin', class: classDef, spec },
    })),
  },
  Decoration: {
    none: { type: 'none' },
    mark: vi.fn((spec) => ({ type: 'mark', spec })),
    replace: vi.fn((spec) => ({
      type: 'replace',
      spec,
      range: vi.fn((from, to) => ({ from, to, type: 'replace', spec })),
    })),
    widget: vi.fn((spec) => ({ type: 'widget', spec })),
    set: vi.fn((ranges) => ({ type: 'set', ranges })),
  },
  WidgetType: class WidgetType {
    eq() { return false; }
  },
}));

describe('mathDecorator', () => {
  it('应该创建数学公式装饰器', () => {
    const decorator = mathDecorator();
    expect(decorator).toBeDefined();
    expect(decorator.extension).toBeDefined();
  });

  it('应该接受选项参数', () => {
    const decorator = mathDecorator({ classPrefix: 'custom' });
    expect(decorator).toBeDefined();
  });

  it('装饰器结构应该包含 extension 字段', () => {
    const decorator = mathDecorator();
    expect(decorator).toHaveProperty('extension');
  });
});
