/**
 * useVSCode Hook 单元测试
 * @module composables/__tests__/useVSCode
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVSCode, type VSCodeApi } from '../useVSCode';
import { withSetup } from '../../utils/testUtils';
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
    // 清除 window.vscode
    delete (window as any).vscode;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).vscode;
  });

  describe('初始化', () => {
    it('应该在 window.vscode 存在时初始化', () => {
      // 模拟 main.ts 已经调用过 acquireVsCodeApi 并挂载
      (window as any).vscode = mockVSCodeApi;

      const { result: { vscode, isReady } } = withSetup(() => useVSCode());

      expect(vscode.value).toStrictEqual(mockVSCodeApi);
      expect(isReady.value).toBe(true);
    });

    it('应该在 window.vscode 不存在时保持未就绪状态', () => {
      const { result: { vscode, isReady } } = withSetup(() => useVSCode());

      expect(vscode.value).toBeNull();
      expect(isReady.value).toBe(false);
    });
  });

  describe('postMessage', () => {
    it('应该发送消息到 Extension', () => {
      (window as any).vscode = mockVSCodeApi;

      const { result: { postMessage } } = withSetup(() => useVSCode());

      const message: VSCodeMessage = {
        type: 'CONTENT_CHANGE',
        payload: { content: 'test' },
      };

      postMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });

    it('在 vscode 未初始化时不应该报错', () => {
      const { result: { postMessage } } = withSetup(() => useVSCode());

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
      const { result: { onMessage } } = withSetup(() => useVSCode());
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);

      const message: VSCodeMessage = {
        type: 'INIT',
        payload: { content: 'hello' },
      };

      window.dispatchEvent(
        new MessageEvent('message', { data: message })
      );

      expect(handler).toHaveBeenCalledWith(message);

      unsubscribe();
    });

    it('应该支持取消监听', () => {
      const { result: { onMessage } } = withSetup(() => useVSCode());
      const handler = vi.fn();

      const unsubscribe = onMessage(handler);
      unsubscribe();

      const message: VSCodeMessage = {
        type: 'INIT',
        payload: { content: 'hello' },
      };

      window.dispatchEvent(
        new MessageEvent('message', { data: message })
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('状态管理', () => {
    it('应该设置状态', () => {
      (window as any).vscode = mockVSCodeApi;

      const { result: { setState } } = withSetup(() => useVSCode());

      const state = { mode: 'source', theme: 'dark' };
      setState(state);

      expect(mockSetState).toHaveBeenCalledWith(state);
    });

    it('应该获取状态', () => {
      const savedState = { mode: 'source', scrollPosition: 100 };
      mockGetState.mockReturnValue(savedState);
      (window as any).vscode = mockVSCodeApi;

      const { result: { getState } } = withSetup(() => useVSCode());

      const state = getState();

      expect(mockGetState).toHaveBeenCalled();
      expect(state).toEqual(savedState);
    });

    it('在 vscode 未初始化时 setState 不应该报错', () => {
      const { result: { setState } } = withSetup(() => useVSCode());

      expect(() => setState({ test: true })).not.toThrow();
      expect(mockSetState).not.toHaveBeenCalled();
    });

    it('在 vscode 未初始化时 getState 应该返回 undefined', () => {
      const { result: { getState } } = withSetup(() => useVSCode());

      const state = getState();

      expect(state).toBeUndefined();
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });
});
