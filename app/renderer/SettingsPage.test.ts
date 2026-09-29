import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from 'vue';
import SettingsPage from './SettingsPage.vue';
import { EDITOR_PALETTES } from '../../webview/src/shared/themeConfig';
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from '../electron/appearance';
import type { AppearanceState } from './electronBridge';

const GEORGIA = "Georgia, 'Times New Roman', serif";

function appearance(over: Partial<AppearanceState> = {}): AppearanceState {
  return { theme: 'github-light', fontFamily: '', fontSize: 16, prefersDark: false, ...over };
}

let mounted: { app: App; el: HTMLElement } | null = null;

function mount(props: Record<string, unknown>): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(SettingsPage, { appearance: appearance(), ...props });
  app.mount(el);
  mounted = { app, el };
  return el;
}

function change(node: Element): void {
  node.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
  mounted?.app.unmount();
  mounted?.el.remove();
  mounted = null;
});

describe('设置页 · 外观栏目', () => {
  it('列出全部内置主题，每个都有名字和色卡', () => {
    const el = mount({});
    const cards = [...el.querySelectorAll('.theme-card')];
    expect(cards).toHaveLength(EDITOR_PALETTES.length);
    expect(cards.map((c) => c.querySelector('.theme-name')!.textContent)).toEqual(
      EDITOR_PALETTES.map((p) => p.name)
    );
    expect(el.querySelectorAll('.theme-swatch')).toHaveLength(EDITOR_PALETTES.length);
  });

  it('色卡用的是该主题自己的颜色', () => {
    const el = mount({});
    const first = el.querySelector('.theme-swatch') as HTMLElement;
    expect(first.style.background).not.toBe('');
    const dracula = EDITOR_PALETTES.findIndex((p) => p.id === 'dracula');
    const swatch = el.querySelectorAll('.theme-swatch')[dracula] as HTMLElement;
    expect(swatch.style.background.replace(/\s/g, '')).toContain('rgb(');
  });

  it('当前主题被标为选中', () => {
    const el = mount({ appearance: appearance({ theme: 'nord' }) });
    const idx = EDITOR_PALETTES.findIndex((p) => p.id === 'nord');
    const cards = [...el.querySelectorAll('.theme-card')];
    expect(cards[idx]!.classList.contains('selected')).toBe(true);
    expect(cards.filter((c) => c.classList.contains('selected'))).toHaveLength(1);
  });

  it('auto 时选中的是系统明暗解析出的那套', () => {
    const dark = mount({ appearance: appearance({ theme: 'auto', prefersDark: true }) });
    const darkIdx = EDITOR_PALETTES.findIndex((p) => p.id === 'github-dark');
    expect([...dark.querySelectorAll('.theme-card')][darkIdx]!.classList.contains('selected')).toBe(true);
    mounted!.app.unmount();

    const light = mount({ appearance: appearance({ theme: 'auto', prefersDark: false }) });
    const lightIdx = EDITOR_PALETTES.findIndex((p) => p.id === 'github-light');
    expect([...light.querySelectorAll('.theme-card')][lightIdx]!.classList.contains('selected')).toBe(true);
  });

  it('点主题卡片抛出该主题 id', () => {
    const onUpdate = vi.fn();
    const el = mount({ onUpdate });
    const idx = EDITOR_PALETTES.findIndex((p) => p.id === 'monokai');
    (el.querySelectorAll('.theme-card')[idx] as HTMLElement).click();
    expect(onUpdate).toHaveBeenCalledWith({ theme: 'monokai' });
  });

  it('勾选跟随系统抛出 auto，取消则固定当前配色', () => {
    const onUpdate = vi.fn();
    const el = mount({ appearance: appearance({ theme: 'nord' }), onUpdate });
    const box = el.querySelector('.auto-row input') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true;
    change(box);
    expect(onUpdate).toHaveBeenCalledWith({ theme: 'auto' });

    mounted!.app.unmount();
    const el2 = mount({ appearance: appearance({ theme: 'auto', prefersDark: true }), onUpdate });
    const box2 = el2.querySelector('.auto-row input') as HTMLInputElement;
    expect(box2.checked).toBe(true);
    box2.checked = false;
    change(box2);
    expect(onUpdate).toHaveBeenLastCalledWith({ theme: 'github-dark' });
  });

  it('字体下拉列出全部内置字体，选中当前值', () => {
    const el = mount({ appearance: appearance({ fontFamily: GEORGIA }) });
    const select = el.querySelector('#settings-font-family') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(
      FONT_FAMILY_OPTIONS.map((o) => o.name)
    );
    expect(select.value).toBe(GEORGIA);
  });

  it('换字体抛出所选字体栈', () => {
    const onUpdate = vi.fn();
    const el = mount({ onUpdate });
    const select = el.querySelector('#settings-font-family') as HTMLSelectElement;
    select.value = GEORGIA;
    change(select);
    expect(onUpdate).toHaveBeenCalledWith({ fontFamily: GEORGIA });
  });

  it('字号下拉列出全部档位，选中当前值', () => {
    const el = mount({ appearance: appearance({ fontSize: 20 }) });
    const select = el.querySelector('#settings-font-size') as HTMLSelectElement;
    expect([...select.options].map((o) => Number(o.value))).toEqual([...FONT_SIZE_OPTIONS]);
    expect(select.value).toBe('20');
  });

  it('换字号抛出数字而不是字符串', () => {
    const onUpdate = vi.fn();
    const el = mount({ onUpdate });
    const select = el.querySelector('#settings-font-size') as HTMLSelectElement;
    select.value = '22';
    change(select);
    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 22 });
  });

  it('示例文字跟着字体与字号变', () => {
    const el = mount({ appearance: appearance({ fontFamily: GEORGIA, fontSize: 24 }) });
    const sample = el.querySelector('.sample') as HTMLElement;
    expect(sample.style.fontSize).toBe('24px');
    expect(sample.style.fontFamily).toContain('Georgia');
  });

  it('系统默认字体时示例不写死 font-family', () => {
    const el = mount({ appearance: appearance({ fontFamily: '' }) });
    expect((el.querySelector('.sample') as HTMLElement).style.fontFamily).toBe('');
  });
});
