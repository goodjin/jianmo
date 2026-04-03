/**
 * 装饰器工具函数单元测试
 * @module decorators/__tests__/utils
 */

import { describe, it, expect } from 'vitest';
import {
  parseLink,
  parseTaskList,
  getHeadingLevel,
  headingFontSizes,
} from '../utils';

describe('decorator utils', () => {
  describe('parseLink', () => {
    it('应该解析标准 Markdown 链接', () => {
      const result = parseLink('[text](url)');
      expect(result).toEqual({ text: 'text', url: 'url' });
    });

    it('应该解析带空格的链接文本', () => {
      const result = parseLink('[hello world](https://example.com)');
      expect(result).toEqual({ text: 'hello world', url: 'https://example.com' });
    });

    it('应该解析带特殊字符的 URL', () => {
      const result = parseLink('[link](https://example.com/path?query=1)');
      expect(result).toEqual({ text: 'link', url: 'https://example.com/path?query=1' });
    });

    it('应该返回 null 对于无效格式', () => {
      expect(parseLink('text')).toBeNull();
      expect(parseLink('[text]')).toBeNull();
      expect(parseLink('(url)')).toBeNull();
      expect(parseLink('')).toBeNull();
    });

    it('应该处理嵌套括号', () => {
      const result = parseLink('[text](url(with)parens)');
      // 简单正则无法完美处理嵌套括号，这是已知限制
      expect(result).toBeNull();
    });
  });

  describe('parseTaskList', () => {
    it('应该解析未勾选的任务', () => {
      const result = parseTaskList('- [ ] task');
      expect(result).toEqual({ checked: false, content: 'task' });
    });

    it('应该解析已勾选的任务', () => {
      const result = parseTaskList('- [x] completed task');
      expect(result).toEqual({ checked: true, content: 'completed task' });
    });

    it('应该解析大写 X 的任务', () => {
      const result = parseTaskList('- [X] task');
      expect(result).toEqual({ checked: true, content: 'task' }); // 大写 X 也视为勾选
    });

    it('应该支持星号列表标记', () => {
      const result = parseTaskList('* [ ] task with star');
      expect(result).toEqual({ checked: false, content: 'task with star' });
    });

    it('应该支持加号列表标记', () => {
      const result = parseTaskList('+ [x] task with plus');
      expect(result).toEqual({ checked: true, content: 'task with plus' });
    });

    it('应该处理前导空格', () => {
      const result = parseTaskList('  - [ ] indented task');
      expect(result).toEqual({ checked: false, content: 'indented task' });
    });

    it('应该返回 null 对于非任务列表', () => {
      expect(parseTaskList('- normal list item')).toBeNull();
      expect(parseTaskList('normal text')).toBeNull();
      expect(parseTaskList('')).toBeNull();
    });

    it('应该处理空内容', () => {
      const result = parseTaskList('- [ ] ');
      expect(result).toEqual({ checked: false, content: '' });
    });
  });

  describe('getHeadingLevel', () => {
    it('应该识别 H1-H6', () => {
      expect(getHeadingLevel('ATXHeading1')).toBe(1);
      expect(getHeadingLevel('ATXHeading2')).toBe(2);
      expect(getHeadingLevel('ATXHeading3')).toBe(3);
      expect(getHeadingLevel('ATXHeading4')).toBe(4);
      expect(getHeadingLevel('ATXHeading5')).toBe(5);
      expect(getHeadingLevel('ATXHeading6')).toBe(6);
    });

    it('应该返回 null 对于非标题节点', () => {
      expect(getHeadingLevel('Paragraph')).toBeNull();
      expect(getHeadingLevel('ListItem')).toBeNull();
      expect(getHeadingLevel('')).toBeNull();
    });

    it('应该返回 null 对于 Setext 标题', () => {
      // Setext 标题有不同的节点名称
      expect(getHeadingLevel('SetextHeading1')).toBeNull();
      expect(getHeadingLevel('SetextHeading2')).toBeNull();
    });
  });

  describe('headingFontSizes', () => {
    it('应该包含所有 6 个级别的字体大小', () => {
      expect(Object.keys(headingFontSizes)).toHaveLength(6);
      expect(headingFontSizes[1]).toBeDefined();
      expect(headingFontSizes[6]).toBeDefined();
    });

    it('应该按级别递减', () => {
      // H1 最大
      expect(headingFontSizes[1]).toBe('2em');
      // H6 最小
      expect(headingFontSizes[6]).toBe('0.85em');
    });

    it('所有值都应该以 em 为单位', () => {
      Object.values(headingFontSizes).forEach((size) => {
        expect(size).toMatch(/em$/);
      });
    });
  });
});
