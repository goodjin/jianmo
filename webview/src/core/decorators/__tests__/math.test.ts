/**
 * 数学公式装饰器单元测试
 * @module core/decorators/__tests__/math
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

import { mathDecorator } from '../math';

describe('mathDecorator', () => {
  it('应该创建数学公式装饰器（Extension）', () => {
    const ext = mathDecorator();
    expect(ext).toBeDefined();
  });

  it('应该接受选项参数', () => {
    const ext = mathDecorator({ classPrefix: 'custom' });
    expect(ext).toBeDefined();
  });
});
