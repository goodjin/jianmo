/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
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

describe('Rich watchdog fallback', () => {
  it('falls back to source when rich not ready after timeout', async () => {
    stubMatchMedia();
    vi.useFakeTimers();

    const ToolbarStub = {
      name: 'Toolbar',
      template: '<div class="toolbar-stub"></div>',
      props: { mode: { type: String, required: false } },
    };
    const w = mount(App as any, {
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

    // 设置状态：认为已就绪，并提供 milkdownRef.setContent 以避免立即失败降级
    // @ts-expect-error setup refs are proxied on vm
    w.vm.editorReady = true;
    // @ts-expect-error setup refs are proxied on vm
    w.vm.currentMode = 'source';
    // @ts-expect-error setup refs are proxied on vm
    w.vm.milkdownRef = { setContent: () => {} };
    await w.vm.$nextTick();

    // 触发切回 rich（会启动 watchdog）
    // @ts-expect-error setup function
    w.vm.switchMode('rich');
    await w.vm.$nextTick();

    // 推进到 watchdog 触发
    vi.advanceTimersByTime(2600);
    await w.vm.$nextTick();

    // @ts-expect-error setup refs are proxied on vm
    expect(w.vm.currentMode).toBe('source');
    expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(true);

    vi.useRealTimers();
  });

  it('does not fall back for empty or small documents once rich reports ready', async () => {
    stubMatchMedia();
    vi.useFakeTimers();

    try {
      for (const content of ['', '# Title', '# Small\n\nhello']) {
        const ToolbarStub = {
          name: 'Toolbar',
          template: '<div class="toolbar-stub"></div>',
          props: { mode: { type: String, required: false } },
        };
        const w = mount(App as any, {
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
        w.vm.editorReady = true;
        // @ts-expect-error setup refs are proxied on vm
        w.vm.currentMode = 'source';
        // @ts-expect-error setup refs are proxied on vm
        w.vm.content = content;
        // @ts-expect-error setup refs are proxied on vm
        w.vm.milkdownRef = { setContent: () => {} };
        await w.vm.$nextTick();

        // @ts-expect-error setup function
        w.vm.switchMode('rich');
        // @ts-expect-error setup function
        w.vm.onRichReady(true);
        vi.advanceTimersByTime(5000);
        await w.vm.$nextTick();

        // @ts-expect-error setup refs are proxied on vm
        expect(w.vm.currentMode).toBe('rich');
        expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(false);
        w.unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait for a second ready event when returning to an already ready Rich instance', async () => {
    stubMatchMedia();
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    let w: ReturnType<typeof mount> | null = null;

    try {
      const ToolbarStub = {
        name: 'Toolbar',
        template: '<div class="toolbar-stub"></div>',
        props: { mode: { type: String, required: false } },
      };
      const MilkdownEditorStub = {
        name: 'MilkdownEditor',
        template: '<div class="milkdown-editor"><div class="ProseMirror" contenteditable="true"></div></div>',
      };
      w = mount(App as any, {
        attachTo: host,
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
      w.vm.currentMode = 'source';
      // @ts-expect-error setup refs are proxied on vm
      w.vm.richReadySuccess = true;
      // @ts-expect-error setup refs are proxied on vm
      w.vm.milkdownRef = { setContent: () => {} };
      await w.vm.$nextTick();

      // @ts-expect-error setup function
      w.vm.switchMode('rich');
      await w.vm.$nextTick();
      // ref 可能被 stub 组件实例覆盖；这里再写一次，确保 watchdog 能读到 getContent
      // @ts-expect-error setup refs are proxied on vm
      w.vm.milkdownRef = { setContent: () => {}, getContent: () => '# Manual\n\nbody\n' };
      await w.vm.$nextTick();

      vi.advanceTimersByTime(5000);
      await w.vm.$nextTick();

      // @ts-expect-error setup refs are proxied on vm
      expect(w.vm.currentMode).toBe('rich');
      expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(false);
      const pkg = (w.vm as any).buildDiagnosticsPayload();
      expect(String(pkg.text)).toContain('"rich:ready:existing"');
    } finally {
      w?.unmount();
      host.remove();
      vi.useRealTimers();
    }
  });

  it('defers fallback once when rich editable DOM exists before ready', async () => {
    stubMatchMedia();
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    let w: ReturnType<typeof mount> | null = null;

    try {
      const ToolbarStub = {
        name: 'Toolbar',
        template: '<div class="toolbar-stub"></div>',
        props: { mode: { type: String, required: false } },
      };
      const MilkdownEditorStub = {
        name: 'MilkdownEditor',
        template: '<div class="milkdown-editor"><div class="ProseMirror" contenteditable="true"></div></div>',
      };
      w = mount(App as any, {
        attachTo: host,
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
      w.vm.currentMode = 'source';
      // @ts-expect-error setup refs are proxied on vm
      w.vm.milkdownRef = { setContent: () => {} };
      await w.vm.$nextTick();

      // @ts-expect-error setup function
      w.vm.switchMode('rich');
      await w.vm.$nextTick();

      vi.advanceTimersByTime(2600);
      await w.vm.$nextTick();

      // 第一次 watchdog 看到 ProseMirror 已出现，只延迟，不立即降级
      // @ts-expect-error setup refs are proxied on vm
      expect(w.vm.currentMode).toBe('rich');
      expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(false);

      const deferredPkg = (w.vm as any).buildDiagnosticsPayload();
      expect(String(deferredPkg.text)).toContain('"watchdog:defer"');

      vi.advanceTimersByTime(1600);
      await w.vm.$nextTick();

      // 延迟后仍未 ready，才降级 Source
      // @ts-expect-error setup refs are proxied on vm
      expect(w.vm.currentMode).toBe('source');
      expect(w.find('[data-testid="rich-fallback-banner"]').exists()).toBe(true);
    } finally {
      w?.unmount();
      host.remove();
      vi.useRealTimers();
    }
  });

  // 注：Rich watchdog 的「ready 兜底」属于运行态修复（避免误判 timeout），
  // jsdom 下较难稳定模拟 Milkdown 的真实 ready/序列化时序，因此不在此处做强断言。
});

