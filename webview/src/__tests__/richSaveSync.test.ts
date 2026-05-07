/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive'],
  template: '<div />',
};

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

describe('Rich save synchronization', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('uses current Rich state instead of stale CM content when saving', async () => {
    const postMessage = vi.fn();
    (window as any).vscode = {
      postMessage,
      getState: vi.fn(),
      setState: vi.fn(),
    };

    const setRichContent = vi.fn();
    const wrapper = mount(App as any, {
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

    // @ts-expect-error setup refs are proxied on vm
    wrapper.vm.editorReady = true;
    // @ts-expect-error setup refs are proxied on vm
    wrapper.vm.currentMode = 'rich';
    // @ts-expect-error setup refs are proxied on vm
    wrapper.vm.content = '# Fresh from Rich\n\nbody';
    // @ts-expect-error setup refs are proxied on vm
    wrapper.vm.milkdownRef = {
      getContent: () => '# Fresh from Milkdown\n\nbody',
      setContent: setRichContent,
    };
    await wrapper.vm.$nextTick();
    postMessage.mockClear();

    // @ts-expect-error setup function is proxied on vm
    wrapper.vm.saveWithTocUpdate();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE',
        payload: { content: '# Fresh from Rich\n\nbody' },
      })
    );
  });
});

