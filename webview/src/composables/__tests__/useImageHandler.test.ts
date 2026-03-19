/**
 * useImageHandler Hook 单元测试
 * @module composables/__tests__/useImageHandler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useImageHandler } from '../useImageHandler';

// Mock useVSCode
vi.mock('../useVSCode', () => ({
  useVSCode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

describe('useImageHandler', () => {
  describe('初始化', () => {
    it('应该有正确的初始状态', () => {
      const { isProcessing, progress } = useImageHandler({
        editorView: ref(null),
      });

      expect(isProcessing.value).toBe(false);
      expect(progress.value).toBe(0);
    });
  });

  describe('handlePaste', () => {
    it('无图片时不应该处理', async () => {
      const { handlePaste } = useImageHandler({ editorView: ref(null) });

      const event = {
        clipboardData: { items: [] },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      await expect(handlePaste(event)).resolves.toBeUndefined();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('clipboardData 为 null 时不应该报错', async () => {
      const { handlePaste } = useImageHandler({ editorView: ref(null) });

      const event = {
        clipboardData: null,
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      await expect(handlePaste(event)).resolves.toBeUndefined();
    });
  });

  describe('handleDrop', () => {
    it('无文件时不应该处理', async () => {
      const { handleDrop } = useImageHandler({ editorView: ref(null) });

      const event = {
        dataTransfer: { files: { length: 0 } },
        preventDefault: vi.fn(),
      } as unknown as DragEvent;

      await expect(handleDrop(event)).resolves.toBeUndefined();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('非图片文件不应该处理', async () => {
      const { handleDrop } = useImageHandler({ editorView: ref(null) });

      const mockFile = { type: 'text/plain', name: 'file.txt', size: 100 };
      const event = {
        dataTransfer: { files: { length: 1, 0: mockFile } },
        preventDefault: vi.fn(),
      } as unknown as DragEvent;

      await expect(handleDrop(event)).resolves.toBeUndefined();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('compressImage', () => {
    it('应该调用 canvas API 进行压缩', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,compressed'),
      };
      vi.stubGlobal('document', {
        createElement: vi.fn().mockReturnValue(mockCanvas),
        documentElement: {
          style: { setProperty: vi.fn() },
          setAttribute: vi.fn(),
        },
      });

      const mockImg = {
        width: 2000,
        height: 1000,
        set src(val: string) {
          this.onload?.();
        },
        onload: null as (() => void) | null,
        onerror: null,
      };
      vi.stubGlobal('Image', vi.fn(() => mockImg));

      const { compressImage } = useImageHandler({ editorView: ref(null) });

      const result = await compressImage('data:image/jpeg;base64,test', {
        maxWidth: 1200,
        maxHeight: 1200,
      });

      expect(result).toBe('data:image/jpeg;base64,compressed');
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });
  });
});
