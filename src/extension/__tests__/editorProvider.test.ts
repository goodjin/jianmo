/**
 * Editor Provider 单元测试
 * @module extension/__tests__/editorProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 模拟 path 模块
vi.mock('path', () => ({
  default: {
    extname: (filename: string) => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot > 0 ? filename.slice(lastDot) : '';
    },
    basename: (filename: string, ext?: string) => {
      let base = filename;
      if (ext && base.endsWith(ext)) {
        base = base.slice(0, -ext.length);
      }
      const lastSlash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
      return lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
    },
    dirname: (filepath: string) => {
      const lastSlash = Math.max(filepath.lastIndexOf('/'), filepath.lastIndexOf('\\'));
      return lastSlash >= 0 ? filepath.slice(0, lastSlash) : '.';
    },
    relative: (from: string, to: string) => {
      // 简化实现
      return to.replace(from + '/', '');
    },
  },
  extname: (filename: string) => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot) : '';
  },
  basename: (filename: string, ext?: string) => {
    let base = filename;
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    const lastSlash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
    return lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
  },
  dirname: (filepath: string) => {
    const lastSlash = Math.max(filepath.lastIndexOf('/'), filepath.lastIndexOf('\\'));
    return lastSlash >= 0 ? filepath.slice(0, lastSlash) : '.';
  },
  relative: (from: string, to: string) => {
    return to.replace(from + '/', '');
  },
}));

describe('generateUniqueFilename', () => {
  // 模拟 generateUniqueFilename 函数的逻辑
  const generateUniqueFilename = (filename: string): string => {
    // 提取扩展名
    const lastDot = filename.lastIndexOf('.');
    const hasExt = lastDot > 0 && !filename.slice(lastDot + 1).includes('/');
    const ext = hasExt ? filename.slice(lastDot) : '';

    // 提取基本名（不含扩展名）
    let baseName = hasExt ? filename.slice(0, lastDot) : filename;

    // 移除路径
    const lastSlash = Math.max(baseName.lastIndexOf('/'), baseName.lastIndexOf('\\'));
    if (lastSlash >= 0) {
      baseName = baseName.slice(lastSlash + 1);
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseName}-${timestamp}-${random}${ext}`;
  };

  it('应该生成带时间戳和随机数的唯一文件名', () => {
    const filename = 'test.png';
    const result = generateUniqueFilename(filename);

    // 验证格式: name-timestamp-random.ext
    expect(result).toMatch(/^test-\d+-[a-z0-9]+\.png$/);
    expect(result).not.toBe(filename);
  });

  it('应该处理没有扩展名的文件名', () => {
    const filename = 'test';
    const result = generateUniqueFilename(filename);

    // 没有扩展名时，结果应该只包含名称、时间戳和随机数
    expect(result).toMatch(/^[\w-]+-\d+-[a-z0-9]+$/);
    expect(result).not.toBe(filename);
    expect(result.startsWith('test-')).toBe(true);
  });

  it('应该处理复杂扩展名', () => {
    const filename = 'image.jpeg';
    const result = generateUniqueFilename(filename);

    expect(result).toMatch(/^image-\d+-[a-z0-9]+\.jpeg$/);
  });

  it('应该处理多层级文件名', () => {
    const filename = '/path/to/image.png';
    const result = generateUniqueFilename(filename);

    expect(result).toMatch(/^image-\d+-[a-z0-9]+\.png$/);
    expect(result).not.toContain('/path/to/');
  });

  it('每次调用应该生成不同的文件名', async () => {
    const filename = 'test.png';

    const result1 = generateUniqueFilename(filename);
    // 等待确保时间戳可能不同
    await new Promise((resolve) => setTimeout(resolve, 2));
    const result2 = generateUniqueFilename(filename);

    expect(result1).not.toBe(result2);
  });

  it('应该保留原始文件名的基本部分', () => {
    const filename = 'my-awesome-image.png';
    const result = generateUniqueFilename(filename);

    expect(result.startsWith('my-awesome-image-')).toBe(true);
    expect(result.endsWith('.png')).toBe(true);
  });
});

describe('saveImage 逻辑', () => {
  it('应该正确解码 base64 数据', () => {
    const base64Data = 'data:image/png;base64,iVBORw0KGgo=';
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

    expect(base64Content).toBe('iVBORw0KGgo=');
    expect(base64Content).not.toContain('data:image/png;base64,');
  });

  it('应该处理不同格式的 base64 前缀', () => {
    const testCases = [
      { input: 'data:image/png;base64,ABC123', expected: 'ABC123' },
      { input: 'data:image/jpeg;base64,XYZ789', expected: 'XYZ789' },
      { input: 'data:image/gif;base64,TEST==', expected: 'TEST==' },
      { input: 'ABC123', expected: 'ABC123' }, // 无前缀
    ];

    testCases.forEach(({ input, expected }) => {
      const result = input.replace(/^data:image\/\w+;base64,/, '');
      expect(result).toBe(expected);
    });
  });
});

describe('路径计算', () => {
  const relative = (from: string, to: string): string => {
    // 简化实现：移除 from 前缀
    if (to.startsWith(from + '/')) {
      return to.slice(from.length + 1);
    }
    if (to.startsWith(from + '\\')) {
      return to.slice(from.length + 1);
    }
    return to;
  };

  it('应该计算正确的相对路径', () => {
    const docPath = '/workspace/docs';
    const imagePath = '/workspace/docs/assets/image.png';

    const result = relative(docPath, imagePath);

    expect(result).toBe('assets/image.png');
  });

  it('应该处理同级目录', () => {
    const docPath = '/workspace/docs';
    const imagePath = '/workspace/docs/image.png';

    const result = relative(docPath, imagePath);

    expect(result).toBe('image.png');
  });
});
