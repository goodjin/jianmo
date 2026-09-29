/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsPanel from '../SettingsPanel.vue';
import { EDITOR_PALETTES } from '../../shared/themeConfig';

describe('SettingsPanel', () => {
  it('renders 10 theme choices and highlights the resolved palette', () => {
    const w = mount(SettingsPanel, {
      props: { theme: 'auto', prefersDark: true },
    });
    const cards = w.findAll('.markly-theme-card');
    expect(cards).toHaveLength(10);
    expect(cards.map((c) => c.get('.markly-theme-name').text())).toEqual(
      EDITOR_PALETTES.map((p) => p.name)
    );
    const selected = cards.find((c) => c.classes().includes('selected'));
    expect(selected?.get('.markly-theme-name').text()).toBe('GitHub Dark');
  });

  it('emits select-theme with palette id', async () => {
    const w = mount(SettingsPanel, {
      props: { theme: 'github-light', prefersDark: false },
    });
    const nord = w.findAll('.markly-theme-card').find((c) => c.text().includes('Nord'));
    expect(nord).toBeTruthy();
    await nord!.trigger('click');
    expect(w.emitted('select-theme')?.[0]).toEqual(['nord']);
  });

  it('emits close', async () => {
    const w = mount(SettingsPanel, {
      props: { theme: 'nord', prefersDark: false },
    });
    await w.get('[aria-label="关闭设置"]').trigger('click');
    expect(w.emitted('close')?.length).toBe(1);
  });
});
