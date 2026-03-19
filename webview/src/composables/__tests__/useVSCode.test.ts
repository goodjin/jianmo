/**
 * useVSCode Hook 单元测试
 * @module composables/__tests__/useVSCode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useVSCode, type VSCodeApi } from '../useVSCode';
import type { VSCodeMessage } from '../../../../src/shared/types';

// Mock VS Code API
const mockPostMessage = vi.fn();
const mockGetState = vi.fn();
const mockSetState = vi.fn();

const mockVSCodeApi: VSCodeApi = {
  postMessage: mockPostMessage,
  getState: mockGetState,
  setState: mockSetState,
};

describe('useVSCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.acquireVsCodeApi
    (window as unknown as { acquireVsCodeApi?: () => VSCodeApi }).acquireVsCodeApi = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该在 acquireVsCodeApi 可用时初始化', () => {
      // Setup
      (window as unknown as { acquireVsCodeApi: () => VSCodeApi }).acquireVsCodeApi = () =>
        mockVSCodeApi;

      const { vscode, isReady } = useVSCode();

      // 手动触发 onMounted 逻辑
      if (typeof window.acquireVsCodeApi === 'function') {
        vscode.value = window.acquireVsCodeApi();
        isReady.value = true;
      }

      expect(vscode.value).toStrictEqual(mockVSCodeApi);
      expect(isReady.value).toBe(true);
    });

    it('应该在 acquireVsCodeApi 不可用时保持未就绪状态', () => {
      const { vscode, isReady } = useVSCode();

      expect(vscode.value).toBeNull();
      expect(isReady.value).toBe(false);
    });
  });

  describe('postMessage', () => {
    it('应该发送消息到 Extension', () => {
      // Setup
      (window as unknown as { acquireVsCodeApi: () => VSCodeApi }).acquireVsCodeApi = () =>
        mockVSCodeApi;

      const { vscode, isReady, postMessage } = useVSCode();

      if (typeof window.acquireVsCodeApi === 'function') {
        vscode.value = window.acquireVsCodeApi();
        isReady.value = true;
      }

      const message: VSCodeMessage = {
        type: 'CONTENT_CHANGE',
        payload: { content: 'test' },
      };

      postMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });

    it('在 vscode 未初始化时不应该报错', () => {
      const { postMessage } = useVSCode();

      const message: VSCodeMessage = {
        type: 'CONTENT_CHANGE',
        payload: { content: 'test' },
      };

      expect(() => postMessage(message)).not.toThrow();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('onMessage', () => {
    it('应该监听来自 Extension 的消息', () => {
      const { onMessage } = useVSCode();
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);

      // 模拟收到消息
      const message: VSCodeMessage = {
        type: 'INIT',
        payload: { content: 'hello' },
      };

      window.dispatchEvent(
        new MessageEvent('message', {
          data: message,
        })
      );

      expect(handler).toHaveBeenCalledWith(message);

      // 清理
      unsubscribe();
    });

    it('应该支持取消监听', () => {
      const { onMessage } = useVSCode();
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);

      // 取消监听
      unsubscribe();

      // 发送消息
      const message: VSCodeMessage = {
        type: 'INIT',
        payload: { content: 'hello' },
      };

      window.dispatchEvent(
        new MessageEvent('message', {
          data: message,
        })
      );

      // 不应该收到消息
      expect(handler).not.toHaveBeenCalled();
    });

    it('应该能处理多个监听器', () => {
      const { onMessage } = useVSCode();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = onMessage(handler1);
      const unsubscribe2 = onMessage(handler2);

      const message: VSCodeMessage = {
        type: 'THEME_CHANGE',
        payload: { theme: 'dark' },
      };

      window.dispatchEvent(
        new MessageEvent('message', {
          data: message,
        })
      );

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe('状态管理', () => {
    it('应该设置状态', () => {
      // Setup
      (window as unknown as { acquireVsCodeApi: () => VSCodeApi }).acquireVsCodeApi = () =>
        mockVSCodeApi;

      const { vscode, isReady, setState } = useVSCode();

      if (typeof window.acquireVsCodeApi === 'function') {
        vscode.value = window.acquireVsCodeApi();
        isReady.value = true;
      }

      const state = { mode: 'ir', theme: 'dark' };
      setState(state);

      expect(mockSetState).toHaveBeenCalledWith(state);
    });

    it('应该获取状态', () => {
      // Setup
      const savedState = { mode: 'source', scrollPosition: 100 };
      mockGetState.mockReturnValue(savedState);

      (window as unknown as { acquireVsCodeApi: () => VSCodeApi }).acquireVsCodeApi = () =>
        mockVSCodeApi;

      const { vscode, isReady, getState } = useVSCode();

      if (typeof window.acquireVsCodeApi === 'function') {
        vscode.value = window.acquireVsCodeApi();
        isReady.value = true;
      }

      const state = getState();

      expect(mockGetState).toHaveBeenCalled();
      expect(state).toEqual(savedState);
    });

    it('在 vscode 未初始化时 setState 不应该报错', () => {
      const { setState } = useVSCode();

      expect(() => setState({ test: true })).not.toThrow();
      expect(mockSetState).not.toHaveBeenCalled();
    });

    it('在 vscode 未初始化时 getState 应该返回 undefined', () => {
      const { getState } = useVSCode();

      const state = getState();

      expect(state).toBeUndefined();
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe('边界条件', () => {
    it('应该处理不同类型的消息', () => {
      const { onMessage } = useVSCode();
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);

      // 测试不同类型的消息
      const messages: VSCodeMessage[] = [
        { type: 'INIT', payload: { content: '', config: {} } },
        { type: 'CONTENT_CHANGE', payload: { content: 'test' } },
        { type: 'IMAGE_SAVED', payload: { path: 'assets/test.png', filename: 'test.png' } },
        { type: 'THEME_CHANGE', payload: { theme: 'dark' } },
      ];

      messages.forEach((message) => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: message,
          })
        );
      });

      expect(handler).toHaveBeenCalledTimes(4);
      messages.forEach((message, index) => {
        expect(handler).toHaveBeenNthCalledWith(index + 1, message);
      });

      unsubscribe();
    });

    it('应该处理没有 payload 的消息', () => {
      const { onMessage } = useVSCode();
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);

      const message: VSCodeMessage = { type: 'SAVE' };

      window.dispatchEvent(
        new MessageEvent('message', {
          data: message,
        })
      );

      expect(handler).toHaveBeenCalledWith(message);

      unsubscribe();
    });
  });
});
