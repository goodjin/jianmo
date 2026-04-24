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
    (wrapper.vm as any).richFallbackBannerVisible = true;
    (wrapper.vm as any).richFallbackBannerReason = 'failed';
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[data-testid="copy-diagnostics-btn"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');

    expect((navigator as any).clipboard.writeText).toHaveBeenCalled();
    const arg = (navigator as any).clipboard.writeText.mock.calls[0][0] as string;
    expect(arg).toContain('"mode"');
    expect(arg).toContain('"source"');
  });
});

