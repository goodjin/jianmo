/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
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

describe('wrapPolicy / tableCellWrap classes', () => {
  it('applies wrap-auto + table-cell-nowrap from config', async () => {
    stubMatchMedia();

    const w = mount(App as any, {
      global: {
        stubs: {
          Toolbar: true,
          OutlinePanel: true,
          FindReplacePanel: true,
          ImagePreview: true,
          MilkdownEditor: true,
        },
      },
    });

    // @ts-expect-error setup refs are proxied on vm
    w.vm.config = {
      editor: {
        theme: 'auto',
        fontSize: 14,
        fontFamily: 'sans-serif',
        wrapPolicy: 'autoWrap',
        tableCellWrap: 'nowrap',
        enableMermaid: true,
        enableShiki: false,
      },
      image: { saveDirectory: './assets', compressThreshold: 512000, compressQuality: 0.8 },
      export: { pdf: { format: 'A4', margin: { top: 25, right: 20, bottom: 25, left: 20 } } },
    };
    await w.vm.$nextTick();

    expect(w.classes()).toContain('wrap-auto');
    expect(w.classes()).toContain('table-cell-nowrap');
  });
});

