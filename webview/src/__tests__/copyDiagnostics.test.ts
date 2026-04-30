import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'inRichTableContext'],
  template: '<div />',
};

describe('copy diagnostics button', () => {
  beforeEach(() => {
    (globalThis as any).window = (globalThis as any).window ?? globalThis;
    (globalThis as any).window.matchMedia =
      (globalThis as any).window.matchMedia ??
      (() =>
        ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as any);
    // minimal clipboard stub
    (globalThis as any).navigator = (globalThis as any).navigator ?? {};
    (globalThis as any).navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    (globalThis as any).window.vscode = {
      postMessage: vi.fn((message: any) => {
        if (message?.type !== 'CHECK_LOCAL_IMAGE_REFS') return;
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'LOCAL_IMAGE_REFS_RESULT',
              payload: {
                requestId: message.payload.requestId,
                results: [
                  { ref: './assets/exists.png', exists: true, resolvedPath: '/repo/assets/exists.png' },
                  { ref: './assets/missing.png', exists: false, resolvedPath: '/repo/assets/missing.png', error: 'not found' },
                ],
              },
            },
          })
        );
      }),
      getState: vi.fn(),
      setState: vi.fn(),
    };
    (globalThis as any).window.__marklyE2E = {
      getDiagnostics: () => ({ mode: 'source', richReadySuccess: false }),
    };
  });

  it('copies diagnostics JSON to clipboard', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          // keep the test lightweight; we only need the banner
          MilkdownEditor: true,
          Toolbar: ToolbarStub,
          ImagePreview: true,
          FindReplacePanel: true,
        },
      },
    });

    // Force state to show fallback banner
    await wrapper.setData?.({});
    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'source';
    (wrapper.vm as any).content = '![ok](./assets/exists.png)\n![missing](./assets/missing.png)\n![remote](https://example.com/a.png)';
    (wrapper.vm as any).richFallbackBannerVisible = true;
    (wrapper.vm as any).richFallbackBannerReason = 'failed';
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[data-testid="copy-diagnostics-btn"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');

    expect((navigator as any).clipboard.writeText).toHaveBeenCalled();
    const arg = (navigator as any).clipboard.writeText.mock.calls[0][0] as string;
    expect(arg).toContain('```json');
    expect(arg).toContain('"mode"');
    expect(arg).toContain('"source"');
    expect(arg).toContain('"richFocused"');
    expect(arg).toContain('"host"');
    expect(arg).toContain('"richStartupAttemptId"');
    expect(arg).toContain('"richStartupWatchdogFired"');
    expect(arg).toContain('"richStartupEvents"');
    expect(arg).toContain('"richRetryCount"');
    expect(arg).toContain('"webviewReloadCount"');
    expect(arg).toContain('"richLastError"');
    expect(arg).toContain('"images"');
    expect(arg).toContain('"totalRefs"');
    expect(arg).toContain('"missingRefs"');
    expect(arg).toContain('./assets/missing.png');
    expect(arg).toContain('/repo/assets/missing.png');
  });

  it('shows image asset actions after missing local image checks', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          MilkdownEditor: true,
          Toolbar: ToolbarStub,
          ImagePreview: true,
          FindReplacePanel: true,
        },
      },
    });

    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'source';
    (wrapper.vm as any).content = '![ok](./assets/exists.png)\n![missing](./assets/missing.png)';
    (wrapper.vm as any).richFallbackBannerVisible = true;
    (wrapper.vm as any).richFallbackBannerReason = 'failed';
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="copy-diagnostics-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    const banner = wrapper.find('[data-testid="image-missing-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('1 个缺失');

    await wrapper.find('[data-testid="open-assets-dir-btn"]').trigger('click');
    expect((window.vscode.postMessage as any).mock.calls).toContainEqual([
      { type: 'OPEN_IMAGE_DIRECTORY', payload: { kind: 'assets' } },
    ]);

    await wrapper.find('[data-testid="repair-first-missing-image-btn"]').trigger('click');
    expect((window.vscode.postMessage as any).mock.calls).toContainEqual([
      { type: 'REPAIR_IMAGE_REF', payload: { ref: './assets/missing.png' } },
    ]);

    await wrapper.find('[data-testid="open-image-assets-panel-btn"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="image-assets-panel"]').text()).toContain('./assets/missing.png');
    expect(wrapper.find('[data-testid="image-assets-panel"]').text()).toContain('/repo/assets/missing.png');
  });

  it('has reload webview self-heal action', async () => {
    const reloadSpy = vi.fn();
    const prevLoc = (globalThis as any).location;
    // jsdom 的 window.location.reload 可能是只读；用 defineProperty 替换为可控 stub
    Object.defineProperty(globalThis as any, 'location', {
      value: { ...(prevLoc ?? {}), reload: reloadSpy },
      configurable: true,
      writable: true,
    });

    const wrapper = mount(App as any, {
      global: {
        stubs: {
          MilkdownEditor: true,
          Toolbar: ToolbarStub,
          ImagePreview: true,
          FindReplacePanel: true,
        },
      },
    });

    await wrapper.setData?.({});
    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'source';
    (wrapper.vm as any).richFallbackBannerVisible = true;
    (wrapper.vm as any).richFallbackBannerReason = 'failed';
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[data-testid="reload-webview-btn"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(reloadSpy).toHaveBeenCalled();
  });
});

