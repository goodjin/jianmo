import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';

import App from '../App.vue';
import { RICH_PERF_T1_CHARS, RICH_PERF_T2_CHARS, getRichPerfTier } from '../utils/richPerfTier';

function getRepoRootFromWebviewCwd(): string {
  // vitest cwd: <repo>/webview
  return path.resolve(process.cwd(), '..');
}

function loadSeed(): string {
  const p = path.join(getRepoRootFromWebviewCwd(), 'docs', 'fixtures', 'm70', '01-seed.md');
  return readFileSync(p, 'utf8');
}

function makeLongDoc(targetChars: number, flattenNewlines = false): string {
  const seed = flattenNewlines ? loadSeed().replace(/\n+/g, ' ') : loadSeed();
  const parts: string[] = [];
  let len = 0;
  const sep = '\n\n';
  while (len < targetChars) {
    parts.push(seed);
    len += seed.length + (parts.length > 1 ? sep.length : 0);
  }
  return parts.join(sep);
}

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive', 'docBaselineTierLabel', 'perfDegradeTitle'],
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

describe('M70 large doc stability gate (fixture + thresholds)', () => {
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

  it('crosses tier thresholds and shows stable degrade banner text', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          MilkdownEditor: MilkdownEditorStub,
          ImagePreview: true,
          OutlinePanel: true,
          BacklinksPanel: true,
        },
      },
    });

    const vm = wrapper.vm as any;
    vm.editorReady = true;

    const docT1 = makeLongDoc(RICH_PERF_T1_CHARS + 1000, true);
    const docT2 = makeLongDoc(RICH_PERF_T2_CHARS + 1000, true);

    expect(getRichPerfTier(docT1)).toBe(1);
    expect(getRichPerfTier(docT2)).toBe(2);

    vm.content = docT1;
    vm.recomputePerfDegradeUi();
    expect(vm.perfDegradeBannerVisible).toBe(true);
    expect(String(vm.perfDegradeReason)).toContain('中等规模文档');

    vm.content = docT2;
    vm.recomputePerfDegradeUi();
    expect(vm.perfDegradeBannerVisible).toBe(true);
    expect(String(vm.perfDegradeReason)).toContain('大文档');
  });
});

