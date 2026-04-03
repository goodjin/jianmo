/**
 * 装饰器单元测试
 * @module core/decorators/__tests__/decorators
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@codemirror/view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codemirror/view')>();
  return {
    ...actual,
    ViewPlugin: {
      fromClass: vi.fn((classDef: unknown, spec: unknown) => ({
        extension: { type: 'viewPlugin', class: classDef, spec },
      })),
    },
    WidgetType: class WidgetType {
      eq() { return false; }
    },
  };
});

vi.mock('@codemirror/language', () => ({
  syntaxTree: vi.fn(() => ({
    iterate: vi.fn(({ enter }: { enter: (node: unknown) => void }) => {
      enter({ type: { name: 'ATXHeading1' }, from: 0, to: 10 });
      enter({ type: { name: 'StrongEmphasis' }, from: 11, to: 20 });
    }),
  })),
}));

import { headingDecorator } from '../heading';
import { emphasisDecorator } from '../emphasis';
import { linkDecorator } from '../link';
import { codeDecorator } from '../code';
import { taskListDecorator } from '../taskList';
import { mathDecorator } from '../math';
import { diagramDecorator } from '../diagram';

describe('decorators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('headingDecorator', () => {
    it('应该创建标题装饰器', () => {
      const decorator = headingDecorator();
      expect(decorator).toBeDefined();
    });

    it('应该接受自定义选项', () => {
      const decorator = headingDecorator({ minimal: true });
      expect(decorator).toBeDefined();
    });
  });

  describe('emphasisDecorator', () => {
    it('应该创建强调装饰器', () => {
      const decorator = emphasisDecorator();
      expect(decorator).toBeDefined();
    });

    it('应该接受自定义选项', () => {
      const decorator = emphasisDecorator({ minimal: true });
      expect(decorator).toBeDefined();
    });
  });

  describe('linkDecorator', () => {
    it('应该创建链接装饰器', () => {
      const decorator = linkDecorator();
      expect(decorator).toBeDefined();
    });
  });

  describe('codeDecorator', () => {
    it('应该创建代码装饰器', () => {
      const decorator = codeDecorator();
      expect(decorator).toBeDefined();
    });
  });

  describe('taskListDecorator', () => {
    it('应该创建任务列表装饰器', () => {
      const decorator = taskListDecorator();
      expect(decorator).toBeDefined();
    });
  });

  describe('mathDecorator', () => {
    it('应该创建数学公式装饰器', () => {
      const ext = mathDecorator();
      expect(ext).toBeDefined();
    });
  });

  describe('diagramDecorator', () => {
    it('应该创建图表装饰器', () => {
      const ext = diagramDecorator();
      expect(ext).toBeDefined();
    });
  });
});
