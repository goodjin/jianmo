import { describe, expect, it } from 'vitest';
import {
  compactHiddenToolbarButtons,
  isToolbarButtonShown,
  normalizeToolbarButtonMap,
  normalizeToolbarFontSize,
  normalizeToolbarShowLabels,
} from '../toolbarPrefs';

describe('toolbarPrefs', () => {
  it('clamps font size into 10-18 and falls back when missing', () => {
    expect(normalizeToolbarFontSize(undefined)).toBe(11);
    expect(normalizeToolbarFontSize(14.4)).toBe(14);
    expect(normalizeToolbarFontSize(3)).toBe(10);
    expect(normalizeToolbarFontSize(40)).toBe(18);
    expect(normalizeToolbarFontSize('12')).toBe(11);
    expect(normalizeToolbarShowLabels(undefined)).toBe(false);
    expect(normalizeToolbarShowLabels(true)).toBe(true);
    expect(normalizeToolbarShowLabels('yes')).toBe(false);
  });

  it('keeps only known button ids and treats missing ids as visible', () => {
    const map = normalizeToolbarButtonMap({ math: false, bold: true, nope: false, h1: 'no' });
    expect(map).toEqual({ math: false, bold: true });
    expect(isToolbarButtonShown(map, 'math')).toBe(false);
    expect(isToolbarButtonShown(map, 'bold')).toBe(true);
    expect(isToolbarButtonShown(map, 'h1')).toBe(true);
    expect(isToolbarButtonShown(undefined, 'link')).toBe(true);
  });

  it('stores only hidden buttons', () => {
    expect(compactHiddenToolbarButtons({ math: false, bold: true, link: false })).toEqual({
      math: false,
      link: false,
    });
    expect(normalizeToolbarButtonMap(null)).toEqual({});
    expect(normalizeToolbarButtonMap(['math'])).toEqual({});
  });
});
