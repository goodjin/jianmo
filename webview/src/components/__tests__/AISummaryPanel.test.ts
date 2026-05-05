import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AISummaryPanel from '../AISummaryPanel.vue';

describe('AISummaryPanel', () => {
  it('emits summarize actions and copy/insert', async () => {
    const w = mount(AISummaryPanel, { props: { loading: false, text: '- x', errorMsg: '' } });
    await w.findAll('.ai-summary-btn')[0]!.trigger('click');
    await w.findAll('.ai-summary-btn')[1]!.trigger('click');
    await w.findAll('.ai-summary-btn')[2]!.trigger('click');
    await w.findAll('.ai-summary-btn')[3]!.trigger('click');
    expect(w.emitted('summarize-document')).toHaveLength(1);
    expect(w.emitted('summarize-section')).toHaveLength(1);
    expect(w.emitted('copy')).toHaveLength(1);
    expect(w.emitted('insert')).toHaveLength(1);
  });
});

