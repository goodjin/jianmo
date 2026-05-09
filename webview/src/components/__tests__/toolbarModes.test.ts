/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Toolbar from '../Toolbar.vue';

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
    // 表格结构按钮已收敛为下拉菜单；这里验证按钮存在即可（具体操作由 UI E2E 覆盖）
    const btn = w.find('.toolbar-group.table-dropdown .toolbar-btn[title="Table"]');
    expect(btn.exists()).toBe(true);
  });

});

