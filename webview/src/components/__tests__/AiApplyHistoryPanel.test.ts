import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AiApplyHistoryPanel from '../AiApplyHistoryPanel.vue';
import type { AiApplyHistoryEntry } from '../../utils/aiApplyHistory';

const sample: AiApplyHistoryEntry = {
  id: 'x',
  ts: 1_700_000_000_000,
  kind: 'rewriteSelection',
  editorMode: 'source',
  replaceFrom: 0,
  appliedText: 'B',
  originalText: 'A',
};

describe('AiApplyHistoryPanel', () => {
  it('emits review and revert', async () => {
    const w = mount(AiApplyHistoryPanel, { props: { entries: [sample] } });
    const btns = w.findAll('.ai-apply-history-btn');
    expect(btns.length).toBe(2);
    await btns[0]!.trigger('click');
    await btns[1]!.trigger('click');
    expect(w.emitted('review')?.[0]).toEqual([sample]);
    expect(w.emitted('revert')?.[0]).toEqual([sample]);
  });

  it('shows empty hint when no entries', () => {
    const w = mount(AiApplyHistoryPanel, { props: { entries: [] } });
    expect(w.find('.ai-apply-history-empty').exists()).toBe(true);
  });
});
