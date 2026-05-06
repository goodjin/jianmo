/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
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

describe('M111: mode switch preserves rich cursor/scroll (best-effort)', () => {
  it('stores selection+scroll when leaving rich, restores when entering rich', async () => {
    stubMatchMedia();
    const ToolbarStub = { name: 'Toolbar', template: '<div />', props: { mode: { type: String, required: false } } };

    const setCursorPosition = vi.fn();
    const setScrollTop = vi.fn();
    const getSelectionRange = vi.fn(() => ({ anchor: 12, head: 12 }));
    const getScrollTop = vi.fn(() => 345);

    const MilkdownEditorStub = defineComponent({
      name: 'MilkdownEditor',
      props: {
        content: { type: String, required: false },
      },
      setup(props, { expose }) {
        expose({
          setContent: vi.fn(),
          getContent: () => String(props.content ?? ''),
          getSelectionRange,
          getScrollTop,
          setCursorPosition,
          setScrollTop,
        });
        return () => h('div');
      },
    });

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
    w.vm.currentMode = 'rich';
    // @ts-expect-error setup refs are proxied on vm
    w.vm.content = '# x';
    await w.vm.$nextTick();
    await w.vm.$nextTick();

    // leave rich
    // @ts-expect-error setup function
    w.vm.switchMode('source');
    await w.vm.$nextTick();
    expect(getScrollTop).toHaveBeenCalled();
    expect(getSelectionRange).toHaveBeenCalled();

    // enter rich
    // @ts-expect-error setup function
    w.vm.switchMode('rich');
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    expect(setScrollTop).toHaveBeenCalledWith(345);
    expect(setCursorPosition).toHaveBeenCalledWith(12, 12);
    w.unmount();
  });
});

