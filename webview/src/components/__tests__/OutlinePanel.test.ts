import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OutlinePanel from '../OutlinePanel.vue';

async function flushOutlineFilterDebounce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}

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

  it('M61: filters by heading text and keeps ancestor path', async () => {
    const content = '# 导论\n## 安装\n## 使用\n# 附录';
    const wrapper = mount(OutlinePanel, {
      props: {
        content,
        currentMode: 'source',
        activeHeadingId: '',
        collapsedHeadingIds: [],
      },
    });
    await wrapper.get('.outline-filter-input').setValue('使用');
    await flushOutlineFilterDebounce();
    expect(wrapper.findAll('.outline-item').map((w) => w.text())).toEqual(['导论', '使用']);
  });

  it('M61: shows empty hint when filter matches nothing', async () => {
    const wrapper = mount(OutlinePanel, {
      props: { content: '# Only', currentMode: 'source', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    await wrapper.get('.outline-filter-input').setValue('zzz');
    await flushOutlineFilterDebounce();
    expect(wrapper.find('.outline-filter-empty').exists()).toBe(true);
    expect(wrapper.findAll('.outline-item')).toHaveLength(0);
  });

  it('M63: shows slug conflict marker when two headings share the same generated id', () => {
    const content = '# Same\n# Same\n';
    const wrapper = mount(OutlinePanel, {
      props: { content, currentMode: 'source', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    const warns = wrapper.findAll('.outline-slug-conflict');
    expect(warns).toHaveLength(2);
    expect(warns[0].attributes('title')).toContain('锚点');
  });

  it('M62: shows drag handles when at least two top-level sections', () => {
    const wrapper = mount(OutlinePanel, {
      props: { content: '# A\n# B\n', currentMode: 'source', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    expect(wrapper.findAll('.outline-drag-handle').length).toBe(2);
  });

  it('M61: Escape clears filter input', async () => {
    const wrapper = mount(OutlinePanel, {
      props: { content: '# A', currentMode: 'source', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    const input = wrapper.get('.outline-filter-input');
    await input.setValue('x');
    await input.trigger('keydown', { key: 'Escape' });
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('M42: merges mermaid fences with headings by source order', () => {
    const content = ['# Intro', '', '```mermaid', 'flowchart LR', '  A-->B', '```', '', '## Detail', ''].join('\n');
    const wrapper = mount(OutlinePanel, {
      props: { content, currentMode: 'rich', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    const texts = wrapper.findAll('.outline-item').map((w) => w.text());
    expect(texts[0]).toBe('Intro');
    expect(texts[1]).toContain('flowchart');
    expect(texts[2]).toBe('Detail');
  });

  it('M42: diagram-only document still lists outline', () => {
    const content = ['```mermaid', 'x', '```'].join('\n');
    const wrapper = mount(OutlinePanel, {
      props: { content, currentMode: 'source', activeHeadingId: '', collapsedHeadingIds: [] },
    });
    expect(wrapper.findAll('.outline-item')).toHaveLength(1);
  });
});

