import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import SettingsPage from './SettingsPage.vue';
import { EDITOR_PALETTES } from '../../webview/src/shared/themeConfig';
import { FONT_SIZE_OPTIONS, READING_FONT_STACK, fontStackForFamily } from '../electron/appearance';
import { listInstalledFontFamilies } from '../electron/systemFonts';
import type { AppearanceState } from './electronBridge';

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

  it('正文字体下拉先是系统默认和思源黑体，后面是这台电脑枚举到的字体', async () => {
    const installed = await listInstalledFontFamilies();
    expect(installed.length).toBeGreaterThan(8);
    const el = mount({
      appearance: appearance({ fontFamily: READING_FONT_STACK }),
      systemFonts: installed,
    });
    expect(el.querySelector('#settings-font-family-label')!.textContent).toBe('正文字体');
    expect(el.textContent).toContain('预览里的正文');
    expect(el.textContent).toContain('这台电脑已安装的字体');
    expect(el.textContent).toContain('按钮、菜单和文件树仍用系统字体');
    const button = el.querySelector('#settings-font-family') as HTMLButtonElement;
    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button.textContent).toContain('思源黑体');
    expect(el.querySelector('#settings-font-family-list')).toBeNull();
    button.click();
    await nextTick();
    const names = [...el.querySelectorAll('#settings-font-family-list [role="option"]')].map((node) =>
      node.textContent?.trim()
    );
    expect(names[0]).toBe('系统默认');
    expect(names[1]).toBe('思源黑体');
    expect(names.slice(2)).toEqual(installed);
    expect(names.length).toBeGreaterThan(10);
    const selected = el.querySelector('#settings-font-family-list [aria-selected="true"]');
    expect(selected?.textContent?.trim()).toBe('思源黑体');
  });

  it('从下拉里选中系统字体时抛出那一款，而不是思源黑体', async () => {
    const installed = await listInstalledFontFamilies();
    const family = installed.find((name) => name === 'DejaVu Sans') ?? installed[0]!;
    const onUpdate = vi.fn();
    const el = mount({
      appearance: appearance({ fontFamily: '' }),
      systemFonts: installed,
      onUpdate,
    });
    (el.querySelector('#settings-font-family') as HTMLButtonElement).click();
    await nextTick();
    const option = [...el.querySelectorAll('#settings-font-family-list [role="option"]')].find(
      (node) => node.textContent?.trim() === family
    ) as HTMLButtonElement;
    option.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith({ fontFamily: fontStackForFamily(family) });
    expect(el.querySelector('#settings-font-family-list')).toBeNull();
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

  it('示例文字用上所选正文字体和字号', () => {
    const el = mount({ appearance: appearance({ fontFamily: READING_FONT_STACK, fontSize: 24 }) });
    const sample = el.querySelector('.sample') as HTMLElement;
    expect(sample.style.fontSize).toBe('24px');
    expect(sample.style.fontFamily).toContain('Noto Sans SC');
    expect(sample.textContent).toContain('这是一段中文示例文字');
  });

  it('系统默认时示例用操作系统字体，不用思源黑体', () => {
    const el = mount({ appearance: appearance({ fontFamily: '' }) });
    const family = (el.querySelector('.sample') as HTMLElement).style.fontFamily;
    expect(family).toContain('apple-system');
    expect(family).toContain('PingFang SC');
    expect(family).not.toContain('Noto Sans SC');
  });

  it('选中系统字体时示例用那一款，不用思源黑体', async () => {
    const installed = await listInstalledFontFamilies();
    const family = installed.find((name) => name === 'Liberation Serif') ?? installed[0]!;
    const el = mount({
      appearance: appearance({ fontFamily: fontStackForFamily(family) }),
      systemFonts: installed,
    });
    const sample = el.querySelector('.sample') as HTMLElement;
    expect(sample.style.fontFamily).toContain(family);
    expect(sample.style.fontFamily).not.toContain('Noto Sans SC');
    expect((el.querySelector('#settings-font-family') as HTMLElement).textContent).toContain(family);
  });
});

describe('设置页 · 阅读', () => {
  it('默认勾选选择即复制', () => {
    const el = mount({});
    const box = el.querySelector('#settings-copy-on-select') as HTMLInputElement;
    expect(box).not.toBeNull();
    expect(box.checked).toBe(true);
    expect(el.querySelector('#settings-reading')!.textContent).toBe('阅读');
  });

  it('关掉时不勾选，再勾上会抛出布尔值', () => {
    const onUpdateReader = vi.fn();
    const el = mount({ copyOnSelect: false, onUpdateReader });
    const box = el.querySelector('#settings-copy-on-select') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true;
    change(box);
    expect(onUpdateReader).toHaveBeenCalledWith({ copyOnSelect: true });
  });
});
