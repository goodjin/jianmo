import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { columnResizingPlugin, gfm } from '@milkdown/preset-gfm';
import { listener } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';

import { footnote } from '../plugins/footnote';
import { marklyTableGridPastePlugin, marklyTableStructureKeymapPlugin } from '../plugins/markly-table-rich';

function getRepoRootFromWebviewCwd(): string {
  // vitest cwd: <repo>/webview
  return path.resolve(process.cwd(), '..');
}

function loadM9Fixtures(): Array<{ name: string; content: string }> {
  const dir = path.join(getRepoRootFromWebviewCwd(), 'docs', 'fixtures', 'm9');
  const names = readdirSync(dir)
    .filter((n) => /^\d{2}-.+\.md$/.test(n))
    .sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({
    name,
    content: readFileSync(path.join(dir, name), 'utf8'),
  }));
}

function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

const MUST_CONTAIN: Record<string, string[]> = {
  '01-basic.md': ['# 标题 1', '## 标题 2', '**加粗**', '*斜体*', '~~删除线~~', '`inline code`', 'https://example.com/path?q=1#hash'],
  '02-lists-and-tasks.md': ['[ ] 任务 1', '[x] 任务 2', '有序 1', '混合缩进子项'],
  '03-blockquote-and-code.md': ['> 一级引用', '```ts', 'export function add', '一行很长'],
  '04-tables-gfm.md': ['| 名称 |', '左对齐', '右对齐'],
  '05-footnotes.md': ['[^1]:', '脚注内容'],
  '06-math.md': ['$$', 'int'],
  '07-mermaid.md': ['```mermaid', 'sequenceDiagram', 'flowchart TD'],
  '08-images-and-links.md': ['![logo](./assets/logo.png)', 'file.zip?from=markly'],
  '09-html-compat.md': ['<span data-x="1">hello</span>', '<details>', '<summary>展开</summary>'],
  '10-super-long-line.md': ['wrap/scroll'],
};

let lastEditor: Editor | null = null;

async function roundTripWithMilkdown(markdown: string): Promise<string> {
  const el = document.createElement('div');
  document.body.appendChild(el);

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, el);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(columnResizingPlugin)
    .use(marklyTableStructureKeymapPlugin)
    .use(marklyTableGridPastePlugin)
    .use(footnote)
    .use(listener)
    .use(history)
    .create();

  lastEditor = editor;
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const out = serializer(view.state.doc);
  return out;
}

afterEach(async () => {
  try {
    lastEditor?.destroy();
  } catch {
    // ignore
  } finally {
    lastEditor = null;
  }
  document.body.innerHTML = '';
});

describe('M9 fixtures round-trip (parse→serialize)', () => {
  const fixtures = loadM9Fixtures();

  it('fixtures should exist', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  for (const fx of fixtures) {
    it(`P→S stable after first normalize: ${fx.name}`, async () => {
      // 说明：Milkdown 的 serializer 会做格式规范化（bullet marker、表格对齐空格、转义等）。
      // 我们不要求“原文完全不变”，而是要求：规范化一次后即可稳定（不应每次保存继续漂移）。
      const out1 = normalizeEol(await roundTripWithMilkdown(fx.content));
      const out2 = normalizeEol(await roundTripWithMilkdown(out1));
      expect(out2).toBe(out1);

      for (const needle of MUST_CONTAIN[fx.name] ?? []) {
        expect(out1).toContain(needle);
      }
    });
  }
});

