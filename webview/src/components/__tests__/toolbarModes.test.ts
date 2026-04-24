/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Toolbar from '../Toolbar.vue';

describe('Toolbar mode switch', () => {
  it('hides IR mode button (rich + source only)', () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });

    const modeBtns = w.findAll('.toolbar .mode-switch .mode-btn');
    expect(modeBtns.length).toBe(2);
    const titles = modeBtns.map((b) => String(b.attributes('title') || ''));
    expect(titles.some((t) => t.includes('IR Mode'))).toBe(false);
    expect(titles.some((t) => t.includes('Rich Mode'))).toBe(true);
    expect(titles.some((t) => t.includes('Source Mode'))).toBe(true);
  });
});

