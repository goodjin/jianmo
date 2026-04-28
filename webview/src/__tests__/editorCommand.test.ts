import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive'],
  template: '<div />',
};

describe('EDITOR_COMMAND message handling', () => {
  beforeEach(() => {
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
  });

  it('toggles outline from an extension command message', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          MilkdownEditor: true,
          ImagePreview: true,
          FindReplacePanel: true,
          OutlinePanel: { template: '<aside data-testid="outline-panel" />' },
        },
      },
    });

    (wrapper.vm as any).editorReady = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="outline-panel"]').exists()).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'EDITOR_COMMAND', payload: { command: 'toggleOutline' } },
      })
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="outline-panel"]').exists()).toBe(true);
  });
});

