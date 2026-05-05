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

  it('M42/M43: stable DOM id + aria-label from fenced %% alt markdown', () => {
    const html = '<pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre>';
    const md = ['```mermaid', '%% alt: 拓扑', 'graph TD; A-->B', '```'].join('\n');
    const out = transformMermaidFencesForExport(html, md);
    expect(out).toContain('id="markly-diagram-1"');
    expect(out).toContain('aria-label="拓扑"');
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

  it('M40: external bundling uses CDN script tag instead of inlined bundle', () => {
    const boot = buildMermaidExportBootstrapScript('default', { bundling: 'external' });
    expect(boot).toContain('cdn.jsdelivr.net/npm/mermaid@');
    expect(boot).toContain('<script src=');
    const embedded = buildMermaidExportBootstrapScript('default', { bundling: 'embedded' });
    expect(embedded.length).toBeGreaterThan(boot.length + 5000);
  });
});

describe('getMermaidExportDocumentCss', () => {
  it('styles await containers', () => {
    expect(getMermaidExportDocumentCss()).toContain('.markly-mermaid-await');
  });
});
