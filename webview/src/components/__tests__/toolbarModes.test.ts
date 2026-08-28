/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Toolbar from '../Toolbar.vue';

describe('Toolbar collapse', () => {
  it('shows expand control when collapsed and hides format rows', () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        collapsed: true,
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });

    expect(w.find('.toolbar-row-primary').exists()).toBe(false);
    expect(w.find('.toolbar-collapse-btn[aria-label="展开工具栏"]').exists()).toBe(true);
  });

  it('emits toggle-collapse when collapse button clicked', async () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        collapsed: false,
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });

    await w.find('.toolbar-collapse-btn[aria-label="收起工具栏"]').trigger('click');
    expect(w.emitted('toggle-collapse')?.length).toBe(1);
  });

  it('emits toggle-collapse when expand button clicked in collapsed state', async () => {
    const w = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        collapsed: true,
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });

    await w.find('.toolbar-collapse-btn[aria-label="展开工具栏"]').trigger('click');
    expect(w.emitted('toggle-collapse')?.length).toBe(1);
  });
});

describe('Toolbar structure', () => {
  it('does not embed mode switch (modes live on App.vue mode rail)', () => {
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

    expect(w.find('.mode-switch').exists()).toBe(false);
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
      },
    });

    const btn = w.find('.toolbar-btn[title="Table"]');
    expect(btn.exists()).toBe(true);
  });
});

describe('Toolbar buttons emit correct events', () => {
  it('Italic button shows italic styling on icon', () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Italic"]');
    expect(btn.classes()).toContain('format-italic');
  });

  it('Strikethrough button shows line-through styling', () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Strikethrough"]');
    expect(btn.classes()).toContain('format-strike');
  });

  it('line numbers button only appears in source mode', () => {
    const rich = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    expect(rich.find('.toolbar-btn[aria-label="Toggle Line Numbers"]').exists()).toBe(false);

    const source = mount(Toolbar as any, {
      props: {
        mode: 'source',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: true,
        findPanelOpen: false,
      },
    });
    const btn = source.find('.toolbar-btn[aria-label="Toggle Line Numbers"]');
    expect(btn.exists()).toBe(true);
    expect(btn.classes()).toContain('active');
  });

  it('undo button is enabled when canUndo is true', () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
        canUndo: true,
        canRedo: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[aria-label="Undo (Ctrl+Z)"]');
    expect(btn.attributes('disabled')).toBeUndefined();
  });

  it('Bold button emits format event with id "bold"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Bold"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')!.length).toBe(1);
    expect(wrapper.emitted('format')![0]).toEqual(['bold']);
  });

  it('Italic button emits format event with id "italic"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Italic"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['italic']);
  });

  it('Blockquote button emits format event with id "quote"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Blockquote"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['quote']);
  });

  it('Clear Format button emits format event with id "clearFormat"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Clear Format"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['clearFormat']);
  });

  it('Bullet List button emits format event with id "bulletList"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Bullet List"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['bulletList']);
  });

  it('Ordered List button emits format event with id "orderedList"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Ordered List"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['orderedList']);
  });

  it('Task List button emits format event with id "taskList"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Task List"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['taskList']);
  });

  it('Link button emits insert event with id "link"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Link"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('insert')![0]).toEqual(['link']);
  });

  it('Code Block button emits insert event with id "codeBlock"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    const btn = wrapper.find('.toolbar-btn[title="Code Block"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('insert')![0]).toEqual(['codeBlock']);
  });

  it('heading dropdown is closed by default and opens on trigger click', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    expect(wrapper.find('.heading-menu').exists()).toBe(false);
    await wrapper.find('.toolbar-btn[title="标题"]').trigger('click');
    expect(wrapper.find('.heading-menu').exists()).toBe(true);
    expect(wrapper.findAll('.heading-menu-btn').length).toBe(6);
  });

  it('H1 menu item emits format event with id "h1" and closes menu', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    await wrapper.find('.toolbar-btn[title="标题"]').trigger('click');
    const btn = wrapper.find('.heading-menu-btn[title="Heading 1"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['h1']);
    expect(wrapper.find('.heading-menu').exists()).toBe(false);
  });

  it('H2 menu item emits format event with id "h2"', async () => {
    const wrapper = mount(Toolbar as any, {
      props: {
        mode: 'rich',
        richTableActive: false,
        zoomPercent: 100,
        showOutline: false,
        showLineNumbers: false,
        findPanelOpen: false,
      },
    });
    await wrapper.find('.toolbar-btn[title="标题"]').trigger('click');
    const btn = wrapper.find('.heading-menu-btn[title="Heading 2"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.emitted('format')![0]).toEqual(['h2']);
  });
});
