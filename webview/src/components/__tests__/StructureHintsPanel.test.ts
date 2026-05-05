import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StructureHintsPanel from '../StructureHintsPanel.vue';

describe('StructureHintsPanel', () => {
  it('无标题时显示说明', () => {
    const w = mount(StructureHintsPanel, { props: { content: 'hello' } });
    expect(w.find('.structure-hints-empty').exists()).toBe(true);
    expect(w.find('.structure-hint-row').exists()).toBe(false);
  });

  it('有断层时列出并可跳转', async () => {
    const md = `# A\n\n#### Deep\n`;
    const w = mount(StructureHintsPanel, { props: { content: md } });
    const btn = w.find('.structure-hint-row');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    const jump = w.emitted('jump');
    expect(jump).toBeTruthy();
    const first = jump![0] as [number, string];
    expect(typeof first[0]).toBe('number');
    expect(first[1].length).toBeGreaterThan(0);
  });
});
