import { describe, expect, it } from 'vitest';
import { sanitizeSvgMarkup } from '../svgSanitize';

describe('sanitizeSvgMarkup (M47)', () => {
  it('drops script tags and inline handlers', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle onclick="evil()" r="1"/></svg>`;
    const o = sanitizeSvgMarkup(raw);
    expect(o).not.toContain('script');
    expect(o).not.toContain('onclick');
    expect(o).toContain('<svg');
    expect(o).toContain('<circle');
  });

  it('M135 drops javascript: href attributes', () => {
    const raw = `<svg><a xlink:href="javascript:alert(1)">x</a><image href='javascript:evil()'/></svg>`;
    const o = sanitizeSvgMarkup(raw);
    expect(o.toLowerCase()).not.toContain('javascript:');
  });

  it('M235: strips set handlers on shapes (common SVG vectors)', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg"><rect onload="evil(1)" width="1" height="1"/></svg>`;
    const o = sanitizeSvgMarkup(raw);
    expect(o.toLowerCase()).not.toContain('onload');
    expect(o).toContain('<rect');
  });
});
