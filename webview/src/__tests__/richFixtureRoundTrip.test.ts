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

function loadFixtures(folder: string): Array<{ name: string; content: string }> {
  const dir = path.join(getRepoRootFromWebviewCwd(), 'docs', 'fixtures', folder);
  const names = readdirSync(dir)
    .filter((n) => /^\d{2}-.+\.md$/.test(n))
    .sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({
    name: `${folder}/${name}`,
    content: readFileSync(path.join(dir, name), 'utf8'),
  }));
}

function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

const MUST_CONTAIN: Record<string, string[]> = {
  'm9/01-basic.md': ['# 标题 1', '## 标题 2', '**加粗**', '*斜体*', '~~删除线~~', '`inline code`', 'https://example.com/path?q=1#hash'],
  'm9/02-lists-and-tasks.md': ['[ ] 任务 1', '[x] 任务 2', '有序 1', '混合缩进子项'],
  'm9/03-blockquote-and-code.md': ['> 一级引用', '```ts', 'export function add', '一行很长'],
  'm9/04-tables-gfm.md': [
    '| 名称 |',
    '左对齐',
    '居中',
    '右对齐',
    // 序列化后对齐行会规范化（例：`:-----------------`、`:----:`、`----:`），用于锁住「对齐信息不丢」
    ':-----------------',
    ':----:',
    '----:',
    '很长很长很长很长很长很长很长很长很长',
    '(empty)',
    '<br />',
  ],
  'm9/11-tables-stacked.md': ['段落 A：表前文本。', '段落 B：两表之间。', '段落 C：表后文本。', '| x |', '| p |', '| a |'],
  'm9/12-table-rich-cells.md': ['*斜体在格内*', '[示例](https://example.com/path)', '`const x = 1`', '**粗体**'],
  'm9/13-table-wide-grid.md': [
    '| c1 | c2',
    '| c5 |',
    '| 6  | <br />',
    '| 7  |',
    '| 12 |',
  ],
  // Milkdown 往返后 `<br />` 常规范为同段内连续文本；仍须保留格内两个语片不丢字
  'm9/14-table-cell-linebreaks.md': ['格内换行', '上行', '下行'],
  'm9/15-table-mixed-align-sparse.md': ['M58', ':-----', ':------:', '--------:', '**粗体居中**', '`code_ok`'],
  'm9/16-table-math-code.md': ['| 名称 |', '$E=mc^2$', '`const x = 1`', '\\frac{a}{b}', '`a_b`'],
  'm9/05-footnotes.md': ['[^1]', '[^1]:', '脚注内容', '同一个脚注再次引用'],
  'm9/06-math.md': ['$$', 'int'],
  'm9/07-mermaid.md': ['```mermaid', 'sequenceDiagram', 'flowchart TD'],
  'm9/08-images-and-links.md': ['![logo](./assets/logo.png)', 'file.zip?from=markly'],
  'm9/09-html-compat.md': ['<span data-x="1">hello</span>', '<details>', '<summary>展开</summary>'],
  'm9/10-super-long-line.md': ['wrap/scroll'],
  'm26/01-real-world-mixed.md': ['# M26 真实文档兼容性样例', '$not_math_inside_code', '![diagram](./assets/diagram.png)', '<details>'],
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
  const fixtures = [...loadFixtures('m9'), ...loadFixtures('m26')];

  it('fixtures should exist', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(14);
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

