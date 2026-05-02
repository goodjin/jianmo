import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OutlinePanel from '../OutlinePanel.vue';

describe('OutlinePanel', () => {
  it('shows full heading text as tooltip and emits jump on click', async () => {
    const content = '# Very Long Heading For Tooltip {#custom}\n\nbody\n\n## Child';
    const wrapper = mount(OutlinePanel, {
      props: {
        content,
        currentMode: 'rich',
        activeHeadingId: '',
        collapsedHeadingIds: [],
      },
    });

    const first = wrapper.find('.outline-item');
    expect(first.text()).toBe('Very Long Heading For Tooltip');
    expect(first.attributes('title')).toBe('Very Long Heading For Tooltip');

    await first.trigger('click');
    expect(wrapper.emitted('jump')?.[0]).toEqual([0, 'very-long-heading-for-tooltip']);
    await wrapper.setProps({ activeHeadingId: 'very-long-heading-for-tooltip' });
    expect(first.classes()).toContain('active');
  });

  it('collapses and expands nested headings without removing sibling sections', async () => {
    const content = '# A\n## A.1\n### A.1.a\n# B\n## B.1';
    const wrapper = mount(OutlinePanel, {
      props: {
        content,
        currentMode: 'rich',
        activeHeadingId: '',
        collapsedHeadingIds: [],
      },
    });

    expect(wrapper.findAll('.outline-item').map((item) => item.text())).toEqual([
      'A',
      'A.1',
      'A.1.a',
      'B',
      'B.1',
    ]);

    await wrapper.find('.outline-collapse').trigger('click');
    const collapsed = wrapper.emitted('update:collapsedHeadingIds')?.[0]?.[0] as string[] | undefined;
    expect(collapsed?.length).toBeGreaterThan(0);
    await wrapper.setProps({ collapsedHeadingIds: collapsed ?? [] });
    expect(wrapper.findAll('.outline-item').map((item) => item.text())).toEqual(['A', 'B', 'B.1']);

    await wrapper.find('.outline-collapse').trigger('click');
    const expanded = wrapper.emitted('update:collapsedHeadingIds')?.pop()?.[0] as string[] | undefined;
    await wrapper.setProps({ collapsedHeadingIds: expanded ?? [] });
    expect(wrapper.findAll('.outline-item').map((item) => item.text())).toEqual([
      'A',
      'A.1',
      'A.1.a',
      'B',
      'B.1',
    ]);
  });
});

