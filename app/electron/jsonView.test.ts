/// <reference path="./jsdom.d.ts" />
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { BOX_COPY_MESSAGE, buildStructuredPreviewHtml, readBoxCopyPayload } from './jsonView';

function copyText(el: Element): string {
  return JSON.parse(el.getAttribute('data-markly-copy') || 'null') as string;
}

function nodeByKey(root: ParentNode, key: string): HTMLElement {
  const keys = [...root.querySelectorAll('.box-key')] as HTMLElement[];
  const found = keys.find((el) => copyText(el) === key);
  const node = found?.closest('.node');
  if (!node) throw new Error(`missing node ${key}`);
  return node as HTMLElement;
}

describe('readBoxCopyPayload', () => {
  it('只接受带字符串 text 的复制消息，空字符串也算', () => {
    expect(readBoxCopyPayload(null)).toBeNull();
    expect(readBoxCopyPayload('MARKLY_COPY_BOX')).toBeNull();
    expect(readBoxCopyPayload({ type: 'OTHER', text: 'a' })).toBeNull();
    expect(readBoxCopyPayload({ type: BOX_COPY_MESSAGE, text: 1 })).toBeNull();
    expect(readBoxCopyPayload({ type: BOX_COPY_MESSAGE })).toBeNull();
    expect(readBoxCopyPayload({ type: BOX_COPY_MESSAGE, text: '' })).toBe('');
    expect(readBoxCopyPayload({ type: BOX_COPY_MESSAGE, text: '雪' })).toBe('雪');
  });
});

describe('buildStructuredPreviewHtml JSON', () => {
  const sample = JSON.stringify({
    name: '雪\n<b>',
    n: 1,
    ok: false,
    empty: '',
    nothing: null,
    tags: ['a', 'b'],
    meta: { id: 2 },
    bag: [],
    obj: {},
  });

  function render(): Document {
    return new JSDOM(buildStructuredPreviewHtml(sample, 'json')).window.document;
  }

  it('键和值各自一框，字符串按原文复制，特殊字符只出现在文本里', () => {
    const doc = render();
    const root = doc.querySelector('.tree > .node > .node-row .box-value') as HTMLElement;
    expect(root.classList.contains('box-object')).toBe(true);
    expect(copyText(root)).toBe(JSON.stringify(JSON.parse(sample)));
    expect(doc.querySelector('.node-children')).not.toBeNull();
    expect(doc.querySelector('.pair-link')).not.toBeNull();

    const nameNode = nodeByKey(doc, 'name');
    const nameKey = nameNode.querySelector('.box-key') as HTMLElement;
    const nameVal = nameNode.querySelector('.box-value') as HTMLElement;
    expect(copyText(nameKey)).toBe('name');
    expect(copyText(nameVal)).toBe('雪\n<b>');
    expect(nameVal.textContent).toContain('雪');
    expect(nameVal.textContent).toContain('<b>');
    expect(nameVal.innerHTML).not.toContain('<b>');
    expect(doc.querySelector('.box button')).toBeNull();
  });

  it('数字、布尔、null、空字符串各用自己的框和复制文本', () => {
    const doc = render();
    const valueOf = (key: string) => nodeByKey(doc, key).querySelector('.box-value') as HTMLElement;

    expect(copyText(valueOf('n'))).toBe('1');
    expect(valueOf('n').textContent).toBe('1');
    expect(copyText(valueOf('ok'))).toBe('false');
    expect(copyText(valueOf('nothing'))).toBe('null');
    expect(copyText(valueOf('empty'))).toBe('');
    expect(valueOf('empty').textContent).toContain('空字符串');
  });

  it('数组每个元素独立成框，对象值再拆成键和值，树枝可以收起', () => {
    const doc = render();
    const tags = nodeByKey(doc, 'tags');
    const tagsBox = tags.querySelector(':scope > .node-row .box-value') as HTMLElement;
    expect(tagsBox.classList.contains('box-array')).toBe(true);
    expect(copyText(tagsBox)).toBe('["a","b"]');
    const items = [...tags.querySelectorAll(':scope > .node-children > .node .box-element')] as HTMLElement[];
    expect(items.map(copyText)).toEqual(['a', 'b']);
    expect(tags.querySelector('.twisty')).not.toBeNull();

    const meta = nodeByKey(doc, 'meta');
    expect(copyText(meta.querySelector(':scope > .node-row .box-value')!)).toBe('{"id":2}');
    const idNode = nodeByKey(meta, 'id');
    expect(copyText(idNode.querySelector('.box-key')!)).toBe('id');
    expect(copyText(idNode.querySelector('.box-value')!)).toBe('2');

    const bag = nodeByKey(doc, 'bag');
    const bagBox = bag.querySelector('.box-value') as HTMLElement;
    expect(copyText(bagBox)).toBe('[]');
    expect(bagBox.textContent).toContain('空数组');
    expect(bag.querySelector('.box-element')).toBeNull();
    expect(bag.querySelector('.twisty')).toBeNull();

    const obj = nodeByKey(doc, 'obj');
    expect(copyText(obj.querySelector('.box-value')!)).toBe('{}');
    expect(obj.textContent).toContain('空对象');
  });

  it('数组里的对象：点元素复制整个对象，点里面的键只复制键', async () => {
    const html = buildStructuredPreviewHtml('[{"name":"a"}, 2]', 'json');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://markly.local/preview.html' });
    const posted: unknown[] = [];
    dom.window.addEventListener('message', (ev: MessageEvent) => posted.push(ev.data));
    const root = dom.window.document.querySelector('.tree > .node > .node-row .box-value') as HTMLElement;
    expect(copyText(root)).toBe('[{"name":"a"},2]');
    const elements = [...dom.window.document.querySelectorAll('.box-element')] as HTMLElement[];
    const objEl = elements.find((el) => copyText(el) === '{"name":"a"}')!;
    const numEl = elements.find((el) => copyText(el) === '2')!;
    expect(objEl).toBeDefined();
    expect(numEl).toBeDefined();

    const key = objEl!.closest('.node')!.querySelector('.box-key') as HTMLElement;
    key.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted.map((data) => readBoxCopyPayload(data))).toEqual(['name']);
    expect(key.classList.contains('is-selected')).toBe(true);
    expect(root.classList.contains('is-selected')).toBe(false);

    root.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(readBoxCopyPayload(posted[1])).toBe('[{"name":"a"},2]');
    expect(root.classList.contains('is-selected')).toBe(true);
    expect(key.classList.contains('is-selected')).toBe(false);
  });

  it('框内已有文字选区时单击不覆盖剪贴板', async () => {
    const html = buildStructuredPreviewHtml('{"name":"雪见"}', 'json');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://markly.local/preview.html' });
    const posted: unknown[] = [];
    dom.window.addEventListener('message', (ev: MessageEvent) => posted.push(ev.data));
    const value = dom.window.document.querySelector('.box-value.box-leaf') as HTMLElement;
    const text = value.firstChild as Text;
    const range = dom.window.document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const sel = dom.window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    value.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const root = dom.window.document.querySelector('.tree > .node > .node-row .box-object') as HTMLElement;
    root.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted.map((data) => readBoxCopyPayload(data))).toEqual(['{"name":"雪见"}']);
    posted.length = 0;

    sel?.removeAllRanges();
    value.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted.map((data) => readBoxCopyPayload(data))).toEqual(['雪见']);
  });

  it('键盘回车同样复制当前框；点提示文字不复制', async () => {
    const html = buildStructuredPreviewHtml('{"k":"v"}', 'json');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://markly.local/preview.html' });
    const posted: unknown[] = [];
    dom.window.addEventListener('message', (ev: MessageEvent) => posted.push(ev.data));
    const hint = dom.window.document.querySelector('.json-hint') as HTMLElement;
    hint.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const key = dom.window.document.querySelector('.box-key') as HTMLElement;
    key.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    key.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted.map((data) => readBoxCopyPayload(data))).toEqual(['k']);
  });

  it('解析失败时展示原因，点框复制原文；BOM 不影响合法 JSON', () => {
    const bad = new JSDOM(buildStructuredPreviewHtml('{', 'json')).window.document;
    expect(bad.querySelector('.json-error-msg')!.textContent).toContain('无法解析 JSON');
    const err = bad.querySelector('.kind-error') as HTMLElement;
    expect(copyText(err)).toBe('{');

    const bom = new JSDOM(buildStructuredPreviewHtml('\uFEFF{"a":1}', 'json')).window.document;
    expect(bom.querySelector('.json-error-msg')).toBeNull();
    expect(copyText(bom.querySelector('.box-key')!)).toBe('a');
  });

  it('空键单独成框，复制出来是空字符串', () => {
    const doc = new JSDOM(buildStructuredPreviewHtml('{"":1}', 'json')).window.document;
    const key = doc.querySelector('.box-key') as HTMLElement;
    expect(copyText(key)).toBe('');
    expect(key.textContent).toContain('空键');
  });
});

describe('buildStructuredPreviewHtml JSONL', () => {
  it('行号在框外，空行跳过，坏行仍可复制原文', () => {
    const source = '{"id":1}\n\nnot json\n{"id":2}\n';
    const doc = new JSDOM(buildStructuredPreviewHtml(source, 'jsonl')).window.document;
    const lines = [...doc.querySelectorAll('.jsonl-line')] as HTMLElement[];
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.querySelector('.line-no')!.textContent)).toEqual(['1', '3', '4']);
    for (const line of lines) {
      expect(line.querySelector('.line-no')!.closest('.box')).toBeNull();
    }
    expect(copyText(lines[0]!.querySelector('.box-record')!)).toBe('{"id":1}');
    expect(copyText(lines[0]!.querySelector('.box-key')!)).toBe('id');
    expect(copyText(lines[0]!.querySelector('.box-value')!)).toBe('1');

    expect(lines[1]!.textContent).toContain('无法解析');
    expect(copyText(lines[1]!.querySelector('.kind-error')!)).toBe('not json');

    expect(copyText(lines[2]!.querySelector('.box-record')!)).toBe('{"id":2}');
  });

  it('数组行的每个元素独立成框；基本类型行复制该值', () => {
    const doc = new JSDOM(buildStructuredPreviewHtml('["a","b"]\n"hi"\n', 'jsonl')).window.document;
    const lines = [...doc.querySelectorAll('.jsonl-line')] as HTMLElement[];
    expect(copyText(lines[0]!.querySelector('.box-record')!)).toBe('["a","b"]');
    const items = [...lines[0]!.querySelectorAll('.box-element')] as HTMLElement[];
    expect(items.map(copyText)).toEqual(['a', 'b']);
    expect(copyText(lines[1]!.querySelector('.box-record')!)).toBe('hi');
    expect(lines[1]!.querySelector('.line-no')!.textContent).toBe('2');
  });

  it('点箭头收起节点，再点展开；点箭头不复制', async () => {
    const html = buildStructuredPreviewHtml('{"tags":["a","b"]}', 'json');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://markly.local/preview.html' });
    const posted: unknown[] = [];
    dom.window.addEventListener('message', (ev: MessageEvent) => posted.push(ev.data));
    const tags = nodeByKey(dom.window.document, 'tags');
    const twisty = tags.querySelector('.twisty') as HTMLElement;
    expect(tags.querySelector('.node-children')).not.toBeNull();
    twisty.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(tags.classList.contains('is-collapsed')).toBe(true);
    expect(twisty.getAttribute('aria-expanded')).toBe('false');
    expect(twisty.textContent).toBe('▸');
    twisty.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(tags.classList.contains('is-collapsed')).toBe(false);
    expect(twisty.getAttribute('aria-expanded')).toBe('true');
    await new Promise((r) => setTimeout(r, 0));
    expect(posted).toEqual([]);
  });

  it('点行号收起这一行，行号仍在框外', async () => {
    const html = buildStructuredPreviewHtml('{"id":1}\n"hi"\n', 'jsonl');
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://markly.local/preview.html' });
    const posted: unknown[] = [];
    dom.window.addEventListener('message', (ev: MessageEvent) => posted.push(ev.data));
    const line = dom.window.document.querySelector('.jsonl-line') as HTMLElement;
    const no = line.querySelector('.line-no') as HTMLElement;
    expect(no.textContent).toBe('1');
    expect(no.closest('.box')).toBeNull();
    no.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(line.classList.contains('is-collapsed')).toBe(true);
    expect(line.querySelector('.twisty')!.getAttribute('aria-expanded')).toBe('false');
    no.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(line.classList.contains('is-collapsed')).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(posted).toEqual([]);
  });

  it('空文件给出说明，不抛错', () => {
    const doc = new JSDOM(buildStructuredPreviewHtml(' \n\n ', 'jsonl')).window.document;
    expect(doc.querySelector('.json-error-msg')!.textContent).toContain('空的');
    expect(copyText(doc.querySelector('.kind-error')!)).toBe(' \n\n ');
  });
});
