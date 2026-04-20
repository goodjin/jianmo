/**
 * Mermaid 预处理：subgraph 标题自动加引号
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { diagramDecorator, preprocessMermaid } from '../diagram';

const renderMock = vi.fn().mockResolvedValue({ svg: '<svg data-ok="1"></svg>' });
vi.mock('mermaid', () => ({
  default: {
    render: (...args: any[]) => renderMock(...args),
  },
}));

describe('preprocessMermaid', () => {
  it('subgraph 标题含空格/括号/中文时自动加双引号', () => {
    const input = [
      'graph TD',
      '  subgraph 企业邮箱系统体系 (核心层)',
      '    A-->B',
      '  end',
    ].join('\n');
    const out = preprocessMermaid(input);
    expect(out).toContain('subgraph "企业邮箱系统体系 (核心层)"');
  });

  it('简单 id 不加引号；已加引号的不重复处理', () => {
    const input = [
      'graph TD',
      '  subgraph core',
      '  end',
      '  subgraph "Already Quoted"',
      '  end',
    ].join('\n');
    const out = preprocessMermaid(input);
    expect(out).toContain('subgraph core');
    expect(out).toContain('subgraph "Already Quoted"');
  });
});

describe('diagramDecorator uses preprocess before render', () => {
  let host: HTMLDivElement | null = null;
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view = null;
    host?.remove();
    host = null;
    renderMock.mockClear();
  });

  it('render() 入参应为预处理后的 code', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);

    const doc = [
      '```mermaid',
      'graph TD',
      '  subgraph 企业邮箱系统体系 (核心层)',
      '    A-->B',
      '  end',
      '```',
    ].join('\n');

    const state = EditorState.create({
      doc,
      extensions: [diagramDecorator()],
    });
    view = new EditorView({ state, parent: host });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(renderMock).toHaveBeenCalled();
    const args = renderMock.mock.calls[0];
    const sent = String(args[1] ?? '');
    expect(sent).toContain('subgraph "企业邮箱系统体系 (核心层)"');
  });
});

