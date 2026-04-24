/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

function stubMatchMedia() {
  (window as any).matchMedia =
    (window as any).matchMedia ||
    (() => ({
      matches: false,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));
}

describe('Rich watchdog fallback', () => {
  it('falls back to source when rich not ready after timeout', async () => {
    stubMatchMedia();
    vi.useFakeTimers();

    const ToolbarStub = {
      name: 'Toolbar',
      template: '<div class="toolbar-stub"></div>',
      props: { mode: { type: String, required: false } },
    };
    const w = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          OutlinePanel: true,
          FindReplacePanel: true,
          ImagePreview: true,
          MilkdownEditor: true,
        },
      },
    });

    // 设置状态：认为已就绪，并提供 milkdownRef.setContent 以避免立即失败降级
    // @ts-expect-error setup refs are proxied on vm
    w.vm.editorReady = true;
    // @ts-expect-error setup refs are proxied on vm
    w.vm.currentMode = 'source';
    // @ts-expect-error setup refs are proxied on vm
    w.vm.milkdownRef = { setContent: () => {} };
    await w.vm.$nextTick();

    // 触发切回 rich（会启动 watchdog）
    // @ts-expect-error setup function
    w.vm.switchMode('rich');
    await w.vm.$nextTick();

    // 推进到 watchdog 触发
    vi.advanceTimersByTime(2600);
    await w.vm.$nextTick();

    // @ts-expect-error setup refs are proxied on vm
    expect(w.vm.currentMode).toBe('source');
    expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(true);

    vi.useRealTimers();
  });
});

