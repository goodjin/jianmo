import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive'],
  template: '<div />',
};

const MilkdownEditorStub = {
  name: 'MilkdownEditor',
  template: '<div />',
  setup(_props: unknown, { expose }: any) {
    expose({
      focus: vi.fn(),
      setContent: vi.fn(),
      getContent: vi.fn(() => ''),
    });
    return {};
  },
};

describe('M41 large doc find predictability', () => {
  beforeEach(() => {
    (globalThis as any).navigator = (globalThis as any).navigator ?? {};
    (globalThis as any).navigator.clipboard = {
      readText: vi.fn().mockResolvedValue(''),
      writeText: vi.fn().mockResolvedValue(undefined),
    };
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

  it('truncates UI match ranges but still computes a total count estimate', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          MilkdownEditor: MilkdownEditorStub,
          ImagePreview: true,
          OutlinePanel: true,
        },
      },
    });

    const vm = wrapper.vm as any;
    vm.editorReady = true;
    vm.findReplaceVisible = true;
    vm.currentMode = 'rich';

    // 6000 matches of "x"
    vm.content = Array.from({ length: 6000 }, () => 'x').join('\n');
    vm.findState.findText = 'x';
    vm.findState.patternMode = 'literal';
    vm.findState.caseSensitive = true;
    vm.findState.wholeWord = false;

    vm.recomputeFindMatches();

    expect(vm.findMatchesTruncated).toBe(true);
    expect(vm.findMatches.length).toBe(5000);
    expect(vm.findTotalCount).toBeGreaterThanOrEqual(6000);

    const pkg = vm.buildDiagnosticsPayload();
    expect((pkg as any).text).toContain('"find"');
    expect((pkg as any).text).toContain('"uiMaxMatches"');
    expect((pkg as any).text).toContain('"docBaselineTier"');
  });
});

