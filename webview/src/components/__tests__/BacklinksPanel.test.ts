import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BacklinksPanel from '../BacklinksPanel.vue';

describe('BacklinksPanel', () => {
  it('shows items and emits open on click', async () => {
    const wrapper = mount(BacklinksPanel, {
      props: {
        items: [{ uri: 'file:///proj/a.md', workspaceRelativePath: 'notes/a.md' }],
        loading: false,
        errorMsg: '',
        truncated: false,
      },
    });
    await wrapper.find('.backlinks-item').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual(['file:///proj/a.md']);
  });

  it('shows workspace error text', () => {
    const wrapper = mount(BacklinksPanel, {
      props: { items: [], loading: false, errorMsg: '请先打开文件夹', truncated: false },
    });
    expect(wrapper.find('.backlinks-error').text()).toContain('文件夹');
    expect(wrapper.findAll('.backlinks-item')).toHaveLength(0);
  });

  it('emits refresh when refresh clicked', async () => {
    const wrapper = mount(BacklinksPanel, {
      props: { items: [], loading: false, errorMsg: '', truncated: false },
    });
    await wrapper.find('.backlinks-refresh').trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('M64: shows truncation hint when truncated', () => {
    const wrapper = mount(BacklinksPanel, {
      props: {
        items: [{ uri: 'file:///x/u.md', workspaceRelativePath: 'u.md' }],
        loading: false,
        errorMsg: '',
        truncated: true,
      },
    });
    expect(wrapper.text()).toContain('截断');
  });
});
