/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
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

describe('M129: restore last reading position', () => {
  it('restores saved rich scrollTop + selection range on mount', async () => {
    stubMatchMedia();
    const setScrollTop = vi.fn();
    const setCursorPosition = vi.fn();

    (window as any).vscode = {
      postMessage: vi.fn(),
      getState: () => ({
        lastReadingPosition: { mode: 'rich', anchor: 10, head: 12, scroll: 222, ts: Date.now() },
      }),
      setState: vi.fn(),
    };

    const MilkdownEditorStub = defineComponent({
      name: 'MilkdownEditor',
      props: { content: { type: String, required: false } },
      setup(_props, { expose }) {
        expose({
          setContent: vi.fn(),
          getSelectionRange: () => ({ anchor: 0, head: 0 }),
          getScrollTop: () => 0,
          setScrollTop,
          setCursorPosition,
        });
        return () => h('div');
      },
    });

    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: { template: '<div />' },
          OutlinePanel: true,
          FindReplacePanel: true,
          ImagePreview: true,
          MilkdownEditor: MilkdownEditorStub,
        },
      },
    });

    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'rich';
    (wrapper.vm as any).content = '# x';
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    expect(setScrollTop).toHaveBeenCalledWith(222);
    expect(setCursorPosition).toHaveBeenCalledWith(10, 12);
    wrapper.unmount();
  });
});

