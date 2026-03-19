/**
 * VS Code 通信 Hook
 * @module composables/useVSCode
 * @description 提供 Webview 与 Extension 之间的通信能力
 */

import { ref, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import type { VSCodeMessage } from '../../../src/shared/types';

/**
 * VS Code API 接口
 */
export interface VSCodeApi {
  /** 发送消息到 Extension */
  postMessage: (message: unknown) => void;
  /** 获取状态 */
  getState: () => unknown;
  /** 设置状态 */
  setState: (state: unknown) => void;
}

/**
 * useVSCode 返回的实例接口
 */
export interface UseVSCodeReturn {
  /** VS Code API 实例 */
  vscode: Ref<VSCodeApi | null>;
  /** 是否已准备好 */
  isReady: Ref<boolean>;
  /** 发送消息到 Extension */
  postMessage: (message: VSCodeMessage) => void;
  /** 监听来自 Extension 的消息 */
  onMessage: (handler: (message: VSCodeMessage) => void) => (() => void);
  /** 设置状态 */
  setState: (state: unknown) => void;
  /** 获取状态 */
  getState: () => unknown;
}

/**
 * VS Code 通信 Hook
 * @returns UseVSCodeReturn 实例
 */
export const useVSCode = (): UseVSCodeReturn => {
  const vscode: Ref<VSCodeApi | null> = ref(null);
  const isReady: Ref<boolean> = ref(false);

  onMounted(() => {
    if (typeof window.acquireVsCodeApi === 'function') {
      vscode.value = window.acquireVsCodeApi();
      isReady.value = true;
    }
  });

  /**
   * 发送消息到 Extension
   * @param message - 消息对象
   */
  const postMessage = (message: VSCodeMessage): void => {
    vscode.value?.postMessage(message);
  };

  /**
   * 监听来自 Extension 的消息
   * @param handler - 消息处理函数
   * @returns 取消监听的函数
   */
  const onMessage = (handler: (message: VSCodeMessage) => void): (() => void) => {
    const listener = (event: MessageEvent) => {
      handler(event.data as VSCodeMessage);
    };

    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
    };
  };

  /**
   * 设置状态
   * @param state - 状态对象
   */
  const setState = (state: unknown): void => {
    vscode.value?.setState(state);
  };

  /**
   * 获取状态
   * @returns 状态对象
   */
  const getState = (): unknown => {
    return vscode.value?.getState();
  };

  return {
    vscode,
    isReady,
    postMessage,
    onMessage,
    setState,
    getState,
  };
};

export default useVSCode;
