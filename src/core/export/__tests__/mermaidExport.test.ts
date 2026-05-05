import { describe, it, expect } from 'vitest';
import {
  transformMermaidFencesForExport,
  readMermaidMinJsFromDisk,
  buildMermaidExportBootstrapScript,
  getMermaidExportDocumentCss,
} from '../mermaidExport';

describe('transformMermaidFencesForExport (M85)', () => {
  it('wraps language-mermaid fence in mermaid await div', () => {
    const html = '<pre><code class="language-mermaid">flowchart LR\n  A--&gt;B\n</code></pre>';
    const out = transformMermaidFencesForExport(html);
    expect(out).toContain('class="mermaid markly-mermaid-await"');
    expect(out).toContain('A-->B');
    expect(out).not.toContain('<code class="language-mermaid">');
  });

  it('ignores non-mermaid code blocks', () => {
    const html = '<pre><code class="language-ts">const x = 1;</code></pre>';
    expect(transformMermaidFencesForExport(html)).toBe(html);
  });
});

describe('readMermaidMinJsFromDisk', () => {
  it('reads non-empty mermaid bundle from node_modules', () => {
    const js = readMermaidMinJsFromDisk();
    expect(js.length).toBeGreaterThan(10_000);
    expect(js).toMatch(/mermaid/i);
  });
});

describe('buildMermaidExportBootstrapScript', () => {
  it('inlines library and initialize + run on DOMContentLoaded', () => {
    const boot = buildMermaidExportBootstrapScript('dark');
    expect(boot).toContain('DOMContentLoaded');
    expect(boot).toContain('mermaid.initialize');
    expect(boot).toContain('"dark"');
    expect(boot).toContain('markly-mermaid-await');
  });
});

describe('getMermaidExportDocumentCss', () => {
  it('styles await containers', () => {
    expect(getMermaidExportDocumentCss()).toContain('.markly-mermaid-await');
  });
});
