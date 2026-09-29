import { describe, it, expect, vi, afterEach } from 'vitest';
import { installVsCodeShim } from './vscodeShim';

/**
 * 行为测试：验证 shim 真正满足 useVSCode 契约（postMessage 转发、onMessage 派发、getState/setState 往返）。
 * 删除任一实现，对应断言会失败 → 非存在性测试。
 */

interface FakeBridge {
  postMessage: ReturnType<typeof vi.fn>;
  onPush: (handler: (msg: unknown) => void) => () => void;
  storeGet: ReturnType<typeof vi.fn>;
  storeSet: ReturnType<typeof vi.fn>;
}

let pushedHandler: ((msg: unknown) => void) | null = null;

function mockElectronBridge(): FakeBridge {
  const store = new Map<string, unknown>();
  pushedHandler = null;
  return {
    postMessage: vi.fn(),
    onPush: (handler) => {
      pushedHandler = handler;
      return () => {
        pushedHandler = null;
      };
    },
    storeGet: vi.fn((key: string) => store.get(key)),
    storeSet: vi.fn((key: string, val: unknown) => {
      store.set(key, val);
    }),
  };
}

describe('installVsCodeShim', () => {
  afterEach(() => {
    delete (window as { vscode?: unknown }).vscode;
    delete (window as { electron?: unknown }).electron;
    pushedHandler = null;
  });

  it('注入 window.vscode 并暴露 postMessage/getState/setState 三个方法', () => {
    (window as { electron?: unknown }).electron = mockElectronBridge();
    installVsCodeShim();
    const vscode = (window as { vscode?: { postMessage: unknown; getState: unknown; setState: unknown } }).vscode;
    expect(vscode).toBeDefined();
    expect(typeof vscode!.postMessage).toBe('function');
    expect(typeof vscode!.getState).toBe('function');
    expect(typeof vscode!.setState).toBe('function');
  });

  it('postMessage 把消息转发给 electron.postMessage（内容不变）', () => {
    const bridge = mockElectronBridge();
    (window as { electron?: unknown }).electron = bridge;
    installVsCodeShim();
    const msg = { type: 'READY', payload: undefined };
    (window as { vscode?: { postMessage: (m: unknown) => void } }).vscode!.postMessage(msg);
    expect(bridge.postMessage).toHaveBeenCalledTimes(1);
    expect(bridge.postMessage).toHaveBeenCalledWith(msg);
  });

  it('getState/setState 经 electron-store 往返（set 后 get 能读回）', () => {
    const bridge = mockElectronBridge();
    (window as { electron?: unknown }).electron = bridge;
    installVsCodeShim();
    const vscode = (window as { vscode?: { getState: () => unknown; setState: (s: unknown) => void } }).vscode!;
    vscode.setState({ mode: 'preview', scroll: 42 });
    expect(vscode.getState()).toEqual({ mode: 'preview', scroll: 42 });
    expect(bridge.storeSet).toHaveBeenCalledWith('webviewState', { mode: 'preview', scroll: 42 });
    expect(bridge.storeGet).toHaveBeenCalledWith('webviewState');
  });

  it('onPush 推送的消息被派发为 window message 事件，data 为原消息', () => {
    const bridge = mockElectronBridge();
    (window as { electron?: unknown }).electron = bridge;
    installVsCodeShim();

    let received: unknown = null;
    const handler = (e: MessageEvent) => {
      received = e.data;
    };
    window.addEventListener('message', handler);

    // 模拟主进程推送 ExtensionMessage
    expect(pushedHandler).not.toBeNull();
    pushedHandler!({ type: 'PREVIEW_HTML', payload: { html: '<h1>hi</h1>' } });
    expect(received).toEqual({ type: 'PREVIEW_HTML', payload: { html: '<h1>hi</h1>' } });

    window.removeEventListener('message', handler);
  });

  it('preload 桥缺失 → 抛明确错误', () => {
    delete (window as { electron?: unknown }).electron;
    expect(() => installVsCodeShim()).toThrow(/electron bridge missing/);
  });
});
