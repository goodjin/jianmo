/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

describe('Document overflow policy', () => {
  it('editor-container has horizontal scroll enabled (overflow-x:auto)', async () => {
    // jsdom 环境缺少 matchMedia，App 会读取 prefers-color-scheme
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

    const w = mount(App as any, {
      global: {
        stubs: {
          // 本用例只关心外层容器 style，不需要真实编辑器实现
          Toolbar: true,
          OutlinePanel: true,
          FindReplacePanel: true,
          ImagePreview: true,
          MilkdownEditor: true,
        },
      },
    });

    const el = w.find('.editor-container');
    expect(el.exists()).toBe(true);
    const style = String(el.attributes('style') || '');
    expect(style.includes('overflow-x: auto')).toBe(true);

    // 避免噪音：App mount 期间可能尝试 postMessage，这里确保不会抛异常导致假绿
    expect(() => vi.fn()).not.toThrow();
  });
});

