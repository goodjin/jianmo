/**
 * Mermaid 渲染失败回退：显示源代码
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { diagramDecorator } from '../diagram';

vi.mock('mermaid', () => ({
  default: {
    render: vi.fn().mockRejectedValue(new Error('Parse error on line 1')),
  },
}));

describe('diagramDecorator fallback', () => {
  let host: HTMLDivElement | null = null;
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view = null;
    host?.remove();
    host = null;
  });

  it('当 mermaid.render 抛错时，展示错误信息与源代码', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    const doc = [
      '```mermaid',
      'graph TD',
      '  A-->B',
      '```',
      '',
    ].join('\n');

    const state = EditorState.create({
      doc,
      extensions: [diagramDecorator()],
    });

    view = new EditorView({ state, parent: host });

    // 等待 widget 异步 import + render 失败分支落地
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const err = host.querySelector('.cm-diagram.cm-diagram-error') as HTMLElement | null;
    expect(err).not.toBeNull();
    expect(err!.textContent || '').toContain('Mermaid 解析失败');
    expect(err!.textContent || '').toContain('Parse error on line 1');

    const pre = err!.querySelector('pre.cm-diagram-source') as HTMLElement | null;
    expect(pre).not.toBeNull();
    expect(pre!.textContent || '').toContain('graph TD');
  });
});

