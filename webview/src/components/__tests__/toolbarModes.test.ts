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
        docBaselineTierLabel: 'S',
        perfDegradeTitle: '文档档位：S',
      },
    });

    const modeBtns = w.findAll('.toolbar .mode-switch .mode-btn');
    expect(modeBtns.length).toBe(2);
    const titles = modeBtns.map((b) => String(b.attributes('title') || ''));
    expect(titles.some((t) => t.includes('IR Mode'))).toBe(false);
    expect(titles.some((t) => t.includes('Rich Mode'))).toBe(true);
    expect(titles.some((t) => t.includes('Source Mode'))).toBe(true);
  });

  it('exposes delete-table control when rich table is active', () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: true,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
        docBaselineTierLabel: 'M',
      },
    });
    const labels = w
      .findAll('.toolbar-group[aria-label="Table structure"] .toolbar-btn')
      .map((b) => String(b.attributes('title') || ''));
    expect(labels.some((t) => t.includes('删除当前表格'))).toBe(true);
  });

  it('M66: shows doc tier indicator when provided', () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'source',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
        docBaselineTierLabel: 'XL',
        perfDegradeTitle: '文档档位：XL；Rich 性能档位：2\n降级项：\n- Mermaid（已关闭）',
      },
    });
    const btn = w.find('.perf-tier-btn');
    expect(btn.exists()).toBe(true);
    expect(String(btn.attributes('title'))).toContain('文档档位');
    expect(btn.text()).toContain('XL');
  });
});

