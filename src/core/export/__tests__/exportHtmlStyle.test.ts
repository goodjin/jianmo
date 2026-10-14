import { describe, expect, it } from 'vitest';
import { buildExportHtmlStyle } from '../exportHtmlStyle';

function ruleBody(css: string, heading: string): string {
  const start = css.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('代码块复制按钮', () => {
  it('语言名留在框内右上角，复制按钮移到框外上沿', () => {
    const css = buildExportHtmlStyle();
    const lang = ruleBody(css, '.markly-code-lang {');
    const copy = ruleBody(css, '.markly-code-copy {');
    const shown = ruleBody(css, '.markly-codeblock:hover .markly-code-copy,');

    expect(lang).toContain('top: 8px');
    expect(lang).toContain('right: 10px');
    expect(copy).toContain('transform: translateY(calc(-100% + 1px))');
    expect(copy).toContain('pointer-events: none');
    expect(copy).not.toContain('top: 6px');
    expect(copy).not.toContain('right: 8px');
    expect(shown).toContain('opacity: 1');
    expect(shown).toContain('pointer-events: auto');
  });
});
