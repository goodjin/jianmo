import { describe, expect, it } from 'vitest';
import type { ExtensionConfig } from '../../src/types';
import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_OPTIONS,
  normalizeAppearancePatch,
  normalizeFontFamily,
  normalizeFontSize,
  normalizeTheme,
  readAppearance,
} from './appearance';

const GEORGIA = "Georgia, 'Times New Roman', serif";

describe('normalizeFontSize', () => {
  it('档位值原样保留', () => {
    for (const n of FONT_SIZE_OPTIONS) expect(normalizeFontSize(n)).toBe(n);
  });

  it('越界收敛到上下限', () => {
    expect(normalizeFontSize(4)).toBe(FONT_SIZE_MIN);
    expect(normalizeFontSize(999)).toBe(FONT_SIZE_MAX);
  });

  it('小数取整', () => {
    expect(normalizeFontSize(16.4)).toBe(16);
    expect(normalizeFontSize(16.6)).toBe(17);
  });

  it('非法值退回默认', () => {
    expect(normalizeFontSize('16')).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeFontSize(null)).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeFontSize(NaN)).toBe(DEFAULT_FONT_SIZE);
  });
});

describe('normalizeFontFamily', () => {
  it('内置字体栈通过', () => {
    for (const o of FONT_FAMILY_OPTIONS) {
      expect(normalizeFontFamily(o.stack)).toBe(o.stack);
    }
  });

  it('不在白名单里的栈一律退回系统默认', () => {
    expect(normalizeFontFamily('Comic Sans MS')).toBe('');
    expect(normalizeFontFamily('Arial; } body { display:none }')).toBe('');
  });

  it('空值与非字符串退回系统默认', () => {
    expect(normalizeFontFamily('')).toBe('');
    expect(normalizeFontFamily(undefined)).toBe('');
    expect(normalizeFontFamily(16)).toBe('');
  });
});

describe('normalizeTheme', () => {
  it('合法主题原样保留', () => {
    expect(normalizeTheme('dracula')).toBe('dracula');
    expect(normalizeTheme('auto')).toBe('auto');
    expect(normalizeTheme('github-dark')).toBe('github-dark');
  });

  it('未知主题退回 auto', () => {
    expect(normalizeTheme('hotdog-stand')).toBe('auto');
    expect(normalizeTheme(undefined)).toBe('auto');
    expect(normalizeTheme(7)).toBe('auto');
  });
});

describe('readAppearance', () => {
  it('从配置取出三项并各自归一化', () => {
    const config = {
      editor: { theme: 'nord', fontFamily: GEORGIA, fontSize: 20 },
    } as unknown as ExtensionConfig;
    expect(readAppearance(config)).toEqual({ theme: 'nord', fontFamily: GEORGIA, fontSize: 20 });
  });

  it('配置缺项时给出安全默认', () => {
    expect(readAppearance({} as ExtensionConfig)).toEqual({
      theme: 'auto',
      fontFamily: '',
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it('配置里的脏值被挡掉', () => {
    const config = {
      editor: { theme: 'bogus', fontFamily: 'Comic Sans MS', fontSize: 400 },
    } as unknown as ExtensionConfig;
    expect(readAppearance(config)).toEqual({
      theme: 'auto',
      fontFamily: '',
      fontSize: FONT_SIZE_MAX,
    });
  });
});

describe('normalizeAppearancePatch', () => {
  it('只改主题时只回主题一项', () => {
    expect(normalizeAppearancePatch({ theme: 'monokai' })).toEqual({ theme: 'monokai' });
  });

  it('只改字号时只回字号一项', () => {
    expect(normalizeAppearancePatch({ fontSize: 22 })).toEqual({ fontSize: 22 });
  });

  it('只改字体时只回字体一项', () => {
    expect(normalizeAppearancePatch({ fontFamily: GEORGIA })).toEqual({ fontFamily: GEORGIA });
  });

  it('三项同时给出时一起返回', () => {
    expect(
      normalizeAppearancePatch({ theme: 'nord', fontFamily: GEORGIA, fontSize: 18 })
    ).toEqual({ theme: 'nord', fontFamily: GEORGIA, fontSize: 18 });
  });

  it('未知键被忽略', () => {
    expect(normalizeAppearancePatch({ theme: 'nord', evil: 'x' })).toEqual({ theme: 'nord' });
  });

  it('键存在但值非法时该键被丢弃，不会误写默认值', () => {
    expect(normalizeAppearancePatch({ theme: 'bogus' })).toBeNull();
    expect(normalizeAppearancePatch({ fontSize: 'big' })).toBeNull();
  });

  it('字体白名单外的值归一为系统默认而不是丢弃', () => {
    expect(normalizeAppearancePatch({ fontFamily: 'Comic Sans MS' })).toEqual({ fontFamily: '' });
  });

  it('非对象或空补丁返回 null', () => {
    expect(normalizeAppearancePatch(null)).toBeNull();
    expect(normalizeAppearancePatch('theme')).toBeNull();
    expect(normalizeAppearancePatch({})).toBeNull();
  });
});
