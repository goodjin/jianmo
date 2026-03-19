/**
 * 装饰器单元测试
 * @module decorators/__tests__/decorators
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headingDecorator } from '../heading';
import { emphasisDecorator } from '../emphasis';
import { linkDecorator } from '../link';
import { codeDecorator } from '../code';
import { taskListDecorator } from '../taskList';
import { mathDecorator } from '../math';

// Mock CodeMirror
vi.mock('@codemirror/view', () => ({
  ViewPlugin: {
    fromClass: vi.fn((classDef, spec) => ({
      extension: { type: 'viewPlugin', class: classDef, spec },
    })),
  },
  Decoration: {
    none: { type: 'none' },
    mark: vi.fn((spec) => ({ type: 'mark', spec })),
    replace: vi.fn((spec) => ({ type: 'replace', spec })),
    widget: vi.fn((spec) => ({ type: 'widget', spec })),
    set: vi.fn((ranges) => ({ type: 'set', ranges })),
  },
  WidgetType: class WidgetType {
    eq() { return false; }
  },
}));

vi.mock('@codemirror/language', () => ({
  syntaxTree: vi.fn(() => ({
    iterate: vi.fn(({ enter }) => {
      // 模拟一些节点
      enter({ type: { name: 'ATXHeading1' }, from: 0, to: 10 });
      enter({ type: { name: 'StrongEmphasis' }, from: 11, to: 20 });
    }),
  })),
}));

describe('decorators', () => {
  let mockView: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockView = {
      state: {
        doc: {
          toString: vi.fn().mockReturnValue('# Heading **bold**'),
          sliceString: vi.fn().mockReturnValue(''),
        },
      },
      viewport: { from: 0, to: 100 },
    };
  });

  describe('headingDecorator', () => {
    it('应该创建标题装饰器', () => {
      const decorator = headingDecorator();
      expect(decorator).toBeDefined();
    });

    it('应该接受自定义选项', () => {
      const decorator = headingDecorator({
        classPrefix: 'custom',
        theme: 'dark',
      });
      expect(decorator).toBeDefined();
    });
  });

  describe('emphasisDecorator', () => {
    it('应该创建强调装饰器', () => {
      const decorator = emphasisDecorator();
      expect(decorator).toBeDefined();
    });

    it('应该接受自定义选项', () => {
      const decorator = emphasisDecorator({
        classPrefix: 'custom',
      });
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
      const decorator = mathDecorator();
      expect(decorator).toBeDefined();
    });
  });
});
