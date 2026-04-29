import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

const ToolbarStub = {
  name: 'Toolbar',
  props: ['mode', 'showOutline', 'showLineNumbers', 'findPanelOpen', 'zoomPercent', 'richTableActive'],
  template: '<div />',
};

const milkdownCalls = {
  insertNode: vi.fn(),
  runRichTableOp: vi.fn(),
  focus: vi.fn(),
};

const MilkdownEditorStub = {
  name: 'MilkdownEditor',
  template: '<div />',
  setup(_props: unknown, { expose }: any) {
    expose(milkdownCalls);
    return {};
  },
};

describe('EDITOR_COMMAND message handling', () => {
  beforeEach(() => {
    milkdownCalls.insertNode.mockReset();
    milkdownCalls.runRichTableOp.mockReset();
    milkdownCalls.focus.mockReset();
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
          MilkdownEditor: MilkdownEditorStub,
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

  it('routes insert commands to the Rich editor with focus restoration', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          MilkdownEditor: MilkdownEditorStub,
          ImagePreview: true,
          FindReplacePanel: true,
          OutlinePanel: true,
        },
      },
    });

    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'rich';
    await wrapper.vm.$nextTick();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'EDITOR_COMMAND', payload: { command: 'insert', value: 'codeBlock' } },
      })
    );
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    expect(milkdownCalls.insertNode).toHaveBeenCalledWith('codeBlock');
    expect(milkdownCalls.focus).toHaveBeenCalled();
  });

  it('routes rich table commands to the Rich editor with the exact operation', async () => {
    const wrapper = mount(App as any, {
      global: {
        stubs: {
          Toolbar: ToolbarStub,
          MilkdownEditor: MilkdownEditorStub,
          ImagePreview: true,
          FindReplacePanel: true,
          OutlinePanel: true,
        },
      },
    });

    (wrapper.vm as any).editorReady = true;
    (wrapper.vm as any).currentMode = 'rich';
    await wrapper.vm.$nextTick();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'EDITOR_COMMAND', payload: { command: 'richTable', value: 'addColAfter' } },
      })
    );
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    expect(milkdownCalls.runRichTableOp).toHaveBeenCalledWith('addColAfter');
    expect(milkdownCalls.focus).toHaveBeenCalled();
  });
});

