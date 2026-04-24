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
    await banner.find('button.retry-btn').trigger('click');
    await w.vm.$nextTick();
    expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(false);

    expect(() => vi.fn()).not.toThrow();
  });
});

