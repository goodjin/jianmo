import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FindReplacePanel from '../FindReplacePanel.vue';

describe('FindReplacePanel', () => {
  it('M67: renders match list and emits jump-to-match on click', async () => {
    const wrapper = mount(FindReplacePanel, {
      props: {
        visible: true,
        matchCount: 3,
        currentMatchIndex: 1,
        matchesPreview: [
          { index: 0, text: '…aaa…' },
          { index: 1, text: '…bbb…' },
          { index: 2, text: '…ccc…' },
        ],
      },
    });

    const rows = wrapper.findAll('.match-row');
    expect(rows).toHaveLength(3);
    expect(rows[1]?.classes()).toContain('active');
    await rows[2]!.trigger('click');
    expect(wrapper.emitted('jump-to-match')?.[0]).toEqual([2]);
  });

  it('M68: emits workspace-search with current query', async () => {
    const wrapper = mount(FindReplacePanel, {
      props: {
        visible: true,
        matchCount: 0,
        currentMatchIndex: -1,
      },
    });
    await wrapper.find('input.panel-input').setValue('world');
    await wrapper.findAll('.icon-actions[aria-label="查找操作"] .icon-btn')[2]!.trigger('click');
    expect(wrapper.emitted('workspace-search')?.[0]).toEqual(['world']);
  });
});

