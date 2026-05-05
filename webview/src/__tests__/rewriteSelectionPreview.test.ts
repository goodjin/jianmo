import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive', 'docBaselineTierLabel', 'perfDegradeTitle'],
  template: '<div />',
};
const OutlinePanelStub = { name: 'OutlinePanel', template: '<div />' };
const BacklinksPanelStub = { name: 'BacklinksPanel', template: '<div />' };
const FindReplacePanelStub = { name: 'FindReplacePanel', template: '<div />' };

describe('M72 rewrite selection diff preview', () => {
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

  it('shows preview modal on AI result instead of auto replacing (source)', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          OutlinePanel: OutlinePanelStub,
          BacklinksPanel: BacklinksPanelStub,
          FindReplacePanel: FindReplacePanelStub,
          ImagePreview: true,
          MilkdownEditor: true,
        },
      },
    });

    const vm = wrapper.vm as any;
    vm.editorReady = true;
    vm.currentMode = 'source';
    vm.content = 'hello world';
    vm.config = {
      telemetry: { enabled: false },
      editor: {
        theme: 'auto',
        fontSize: 14,
        fontFamily: 'system-ui',
        wrapPolicy: 'autoWrap',
        tableCellWrap: 'wrap',
        enableMermaid: true,
        enableShiki: false,
        richTableColumnResize: 'auto',
      },
      image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8, sameNameHandling: 'rename' },
      export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 }, includeToc: true, displayHeaderFooter: true } },
      ai: { rewriteSelectionEnabled: true },
    };

    // simulate a pending rewrite
    vm.pendingRewriteSelection = { requestId: 'rw-1', mode: 'source', from: 0, to: 5 };
    vm.rewritePreviewMode = 'source';
    vm.rewritePreviewFrom = 0;
    vm.rewritePreviewTo = 5;
    vm.rewritePreviewOriginal = 'hello';

    vm.handleMessage({ data: { type: 'AI_REWRITE_SELECTION_RESULT', payload: { requestId: 'rw-1', ok: true, text: 'Hello.' } } });
    await wrapper.vm.$nextTick();

    expect(vm.rewritePreviewVisible).toBe(true);
    expect(vm.rewritePreviewRewritten).toBe('Hello.');
  });
});

