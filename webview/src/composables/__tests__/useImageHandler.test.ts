/**
 * useImageHandler Hook 单元测试
 * @module composables/__tests__/useImageHandler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useImageHandler } from '../useImageHandler';

const vscodeMock = vi.hoisted(() => ({
  postMessage: vi.fn(),
  listeners: [] as Array<(message: any) => void>,
}));

// Mock useVSCode
vi.mock('../useVSCode', () => ({
  useVSCode: () => ({
    postMessage: vscodeMock.postMessage,
    onMessage: vi.fn((handler: (message: any) => void) => {
      vscodeMock.listeners.push(handler);
      return () => {
        const idx = vscodeMock.listeners.indexOf(handler);
        if (idx >= 0) vscodeMock.listeners.splice(idx, 1);
      };
    }),
  }),
}));

describe('useImageHandler', () => {
  beforeEach(() => {
    vscodeMock.postMessage.mockReset();
    vscodeMock.listeners.length = 0;
  });

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

    it('图片粘贴成功后会上传并插入返回的 Markdown 路径', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(123);
      vi.stubGlobal(
        'FileReader',
        class {
          result = 'data:image/png;base64,abc';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          readAsDataURL() {
            this.onload?.();
          }
        }
      );

      const insertMarkdown = vi.fn();
      const { handlePaste } = useImageHandler({
        editorView: ref(null),
        insertMarkdown,
      });
      const file = new File([new Uint8Array([1])], 'clip.png', { type: 'image/png' });
      const event = {
        clipboardData: {
          items: [{ type: 'image/png', getAsFile: () => file }],
        },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      const pending = handlePaste(event);
      await vi.waitFor(() => expect(vscodeMock.postMessage).toHaveBeenCalled());
      expect(event.preventDefault).toHaveBeenCalled();
      const sent = vscodeMock.postMessage.mock.calls[0][0] as {
        type: string;
        payload: { base64: string; filename: string; requestId: string };
      };
      expect(sent.type).toBe('UPLOAD_IMAGE');
      expect(sent.payload.base64).toBe('data:image/png;base64,abc');
      expect(sent.payload.filename).toBe('image-123.png');
      expect(sent.payload.requestId).toMatch(/./);

      vscodeMock.listeners[0]?.({
        type: 'IMAGE_SAVED',
        payload: { filename: 'image-123.png', path: 'assets/image-123.png', requestId: sent.payload.requestId },
      });
      await pending;

      expect(insertMarkdown).toHaveBeenCalledWith('![image-123](assets/image-123.png)');
    });

    it('同名策略重命名保存时插入实际落盘文件名', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(777);
      vi.stubGlobal(
        'FileReader',
        class {
          result = 'data:image/png;base64,abc';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          readAsDataURL() {
            this.onload?.();
          }
        }
      );

      const insertMarkdown = vi.fn();
      const { handlePaste } = useImageHandler({
        editorView: ref(null),
        insertMarkdown,
      });
      const file = new File([new Uint8Array([1])], 'clip.png', { type: 'image/png' });
      const event = {
        clipboardData: {
          items: [{ type: 'image/png', getAsFile: () => file }],
        },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      const pending = handlePaste(event);
      await vi.waitFor(() => expect(vscodeMock.postMessage).toHaveBeenCalled());
      const sent = vscodeMock.postMessage.mock.calls[0][0] as { payload: { requestId: string } };
      vscodeMock.listeners[0]?.({
        type: 'IMAGE_SAVED',
        payload: {
          filename: 'image-777-2.png',
          path: 'assets/image-777-2.png',
          requestId: sent.payload.requestId,
        },
      });
      await pending;

      expect(insertMarkdown).toHaveBeenCalledWith('![image-777-2](assets/image-777-2.png)');
    });

    it('图片保存失败时记录错误且不会插入 Markdown', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(456);
      vi.stubGlobal(
        'FileReader',
        class {
          result = 'data:image/png;base64,abc';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          readAsDataURL() {
            this.onload?.();
          }
        }
      );

      const insertMarkdown = vi.fn();
      const onError = vi.fn();
      const { handlePaste, lastError } = useImageHandler({
        editorView: ref(null),
        insertMarkdown,
        onError,
      });
      const file = new File([new Uint8Array([1])], 'clip.png', { type: 'image/png' });
      const event = {
        clipboardData: {
          items: [{ type: 'image/png', getAsFile: () => file }],
        },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent;

      const pending = handlePaste(event);
      await vi.waitFor(() => expect(vscodeMock.postMessage).toHaveBeenCalled());
      const sent = vscodeMock.postMessage.mock.calls[0][0] as { payload: { requestId: string; filename: string } };
      vscodeMock.listeners[0]?.({
        type: 'IMAGE_SAVE_FAILED',
        payload: { filename: sent.payload.filename, error: 'disk full', requestId: sent.payload.requestId },
      });
      await pending;

      expect(lastError.value).toBe('disk full');
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }));
      expect(insertMarkdown).not.toHaveBeenCalled();
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

  it('超过压缩阈值时调用 onCompressingStart 再走压缩与上传（M₃₀）', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(999);
    const onCompressingStart = vi.fn();
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:image/png;base64,abc';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onload?.();
        }
      }
    );
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,smaller'),
    };
    vi.stubGlobal('document', {
      ...document,
      createElement: vi.fn().mockReturnValue(mockCanvas),
    });
    const mockImg: any = {
      width: 10,
      height: 10,
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      },
      onload: null as (() => void) | null,
      onerror: null,
    };
    vi.stubGlobal('Image', vi.fn(() => mockImg));

    const insertMarkdown = vi.fn();
    const { handlePaste } = useImageHandler({
      editorView: ref(null),
      insertMarkdown,
      compressThreshold: 4,
      onCompressingStart,
    });
    const file = new File([new Uint8Array(10)], 'big.png', { type: 'image/png' });
    const event = {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    const pending = handlePaste(event);
    await vi.waitFor(() => expect(onCompressingStart).toHaveBeenCalled());
    await vi.waitFor(() => expect(vscodeMock.postMessage).toHaveBeenCalled());
    const sent = vscodeMock.postMessage.mock.calls[0][0] as { payload: { requestId: string } };
    vscodeMock.listeners[0]?.({
      type: 'IMAGE_SAVED',
      payload: { filename: 'image-999.png', path: 'assets/image-999.png', requestId: sent.payload.requestId },
    });
    await pending;
    expect(insertMarkdown).toHaveBeenCalled();
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

  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
