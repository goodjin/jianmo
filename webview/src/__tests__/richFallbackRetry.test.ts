/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

describe('Rich fallback banner + retry', () => {
  it('shows banner after rich ready=false and can retry (hides banner)', async () => {
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

    // stub MilkdownEditor：我们手动触发 ready 事件
    const MilkdownEditorStub = {
      name: 'MilkdownEditor',
      template: '<div class="milkdown-stub"></div>',
    };
    const ToolbarStub = {
      name: 'Toolbar',
      template: '<div class="toolbar-stub"></div>',
      props: {
        mode: { type: String, required: false },
      },
    };

    const w = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          OutlinePanel: true,
          FindReplacePanel: true,
          ImagePreview: true,
          MilkdownEditor: MilkdownEditorStub,
        },
      },
    });

    // 强制进入“已就绪 + 当前 rich”状态，确保 banner 的 v-if 生效
    // @ts-expect-error setup refs are proxied on vm
    w.vm.editorReady = true;
    // @ts-expect-error setup refs are proxied on vm
    w.vm.currentMode = 'rich';
    await w.vm.$nextTick();

    // 直接调用组件方法：模拟 Rich ready=false（会触发自动降级到 source 并展示 banner）
    // @ts-expect-error expose setup state
    w.vm.onRichReady(false);
    await w.vm.$nextTick();

    const banner = w.find('[data-testid="rich-fallback-banner"]');
    expect(banner.exists()).toBe(true);

    // 点击重试：应隐藏 banner（并尝试切回 rich）
    await banner.find('[data-testid="retry-rich-from-fallback-btn"]').trigger('click');
    await w.vm.$nextTick();
    expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(false);

    expect(() => vi.fn()).not.toThrow();
  });

  it('records retry cleanup and retry result in diagnostics', async () => {
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
    vi.useFakeTimers();

    try {
      const MilkdownEditorStub = {
        name: 'MilkdownEditor',
        template: '<div class="milkdown-stub"></div>',
      };
      const ToolbarStub = {
        name: 'Toolbar',
        template: '<div class="toolbar-stub"></div>',
        props: {
          mode: { type: String, required: false },
        },
      };

      const w = mount(App as any, {
        global: {
          stubs: {
            Toolbar: ToolbarStub,
            OutlinePanel: true,
            FindReplacePanel: true,
            ImagePreview: true,
            MilkdownEditor: MilkdownEditorStub,
          },
        },
      });

      // @ts-expect-error setup refs are proxied on vm
      w.vm.editorReady = true;
      // @ts-expect-error setup refs are proxied on vm
      w.vm.currentMode = 'source';
      // @ts-expect-error setup refs are proxied on vm
      w.vm.milkdownRef = { setContent: () => {} };
      await w.vm.$nextTick();

      // @ts-expect-error setup function
      w.vm.switchMode('rich');
      vi.advanceTimersByTime(2600);
      await w.vm.$nextTick();
      expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(true);

      await w.find('[data-testid="retry-rich-from-fallback-btn"]').trigger('click');
      await w.vm.$nextTick();

      // @ts-expect-error setup function
      w.vm.onRichReady(true);
      const successPkg = (w.vm as any).buildDiagnosticsPayload();
      const successText = String(successPkg.text);
      expect(successText).toContain('"retry:rich"');
      expect(successText).toContain('"retry:cleanup"');
      expect(successText).toContain('"rich:ready:true"');
      expect(successText).toContain('"richRetryCount": 1');
    } finally {
      vi.useRealTimers();
    }
  });
});

