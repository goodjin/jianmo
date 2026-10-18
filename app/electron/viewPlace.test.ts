import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLACE_ANCHOR,
  PLACE_READ,
  PLACE_RESTORE,
  captureSourceAnchor,
  findLineForSnippet,
  keepPlace,
  measureSourceBox,
  placeRuntimeSource,
  readPlaceAnchor,
  readableSnippet,
  scrollTopForLine,
  scrollTopForSource,
} from './viewPlace';

function longDoc(): { text: string; laterLine: number; later: string } {
  const later = '靠近文末的这一节还在看';
  const lines = ['# 开头', '', '第一段在最上面。'];
  for (let i = 0; i < 30; i += 1) lines.push(`填充行 ${i}，用来把后面的内容推远。`);
  const laterLine = lines.length;
  lines.push(`## ${later}`);
  lines.push('后面还有一句，不要当成当前位置。');
  return { text: lines.join('\n'), laterLine, later };
}

const metrics = { paddingTop: 16, lineHeight: 22, scrollHeight: 4000, clientHeight: 400 };

describe('readableSnippet', () => {
  it('去掉标题记号和强调，留下预览里看得到的字', () => {
    expect(readableSnippet('## 靠近文末的这一节还在看')).toBe('靠近文末的这一节还在看');
    expect(readableSnippet('- [x] 这件事做完了')).toBe('这件事做完了');
    expect(readableSnippet('这是**加粗**的句子')).toBe('这是加粗的句子');
  });

  it('分隔线和代码围栏不当成位置', () => {
    expect(readableSnippet('---')).toBe('');
    expect(readableSnippet('```js')).toBe('');
  });
});

describe('源码和预览对位置', () => {
  it('预览里看到的后半段，切到源码后落在同一句，而不是文首', () => {
    const doc = longDoc();
    const top = scrollTopForSource(doc.text, { snippet: doc.later, ratio: 0 }, metrics);
    expect(top).toBe(scrollTopForLine(doc.laterLine, metrics.paddingTop, metrics.lineHeight));
    expect(top).toBeGreaterThan(metrics.lineHeight * 10);
    expect(findLineForSnippet(doc.text, doc.later)).toBe(doc.laterLine);
  });

  it('源码滚到后半段再切回预览时，记下的是那一句，比例再大也不会改口', () => {
    const doc = longDoc();
    const scrolled = scrollTopForLine(doc.laterLine, metrics.paddingTop, metrics.lineHeight);
    const anchor = captureSourceAnchor(doc.text, scrolled, metrics);
    expect(anchor.snippet).toBe(doc.later);
    expect(anchor.snippet).not.toContain('#');
    const back = scrollTopForSource(doc.text, { snippet: anchor.snippet, ratio: 0 }, metrics);
    expect(back).toBe(scrolled);
    const first = scrollTopForSource(doc.text, { snippet: '第一段在最上面', ratio: 1 }, metrics);
    expect(first).toBe(scrollTopForLine(2, metrics.paddingTop, metrics.lineHeight));
    expect(first).toBeLessThan(scrolled);
  });

  it('对不上文字时才用滚动比例，而不是一律回到文首', () => {
    const top = scrollTopForSource('只有一句。', { snippet: '', ratio: 0.5 }, metrics);
    expect(top).toBe(Math.round(0.5 * (metrics.scrollHeight - metrics.clientHeight)));
    expect(top).toBeGreaterThan(0);
  });
});

describe('keepPlace', () => {
  it('预览没回话时留在上次那一句，读到新的一句就跟着走', () => {
    const later = { snippet: '靠近文末的这一节还在看', ratio: 0 };
    expect(keepPlace({ snippet: '', ratio: 0 }, later)).toEqual(later);
    expect(keepPlace({ snippet: '第一段在最上面', ratio: 0 }, later).snippet).toBe('第一段在最上面');
  });
});

describe('readPlaceAnchor', () => {
  it('只认预览回传的位置', () => {
    expect(readPlaceAnchor({ type: 'OTHER', snippet: '甲', ratio: 0.2 })).toBeNull();
    expect(readPlaceAnchor({ type: PLACE_ANCHOR, snippet: '## 甲乙丙', ratio: 1.4 })).toEqual({
      snippet: '甲乙丙',
      ratio: 1,
    });
  });
});

describe('预览位置脚本', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { __marklyPlace?: number }).__marklyPlace;
    vi.restoreAllMocks();
  });

  function install(doc: Document = document): { postMessage: ReturnType<typeof vi.fn> } {
    const parent = { postMessage: vi.fn() };
    const run = new Function('document', 'parent', 'window', placeRuntimeSource());
    run(doc, parent, window);
    return parent;
  }

  it('脚本源里不能出现 </script>，否则插进 HTML 会被截断', () => {
    expect(placeRuntimeSource().includes('</script>')).toBe(false);
    expect(placeRuntimeSource()).toContain(PLACE_READ);
    expect(placeRuntimeSource()).toContain(PLACE_RESTORE);
  });

  it('问现在看到哪时，回答视口上方那一句，而不是文首', () => {
    const early = document.createElement('p');
    early.textContent = '第一段在最上面。';
    const later = document.createElement('p');
    later.textContent = '靠近文末的这一节还在看。后面还有。';
    document.body.append(early, later);
    const laterNode = later.firstChild as Text;
    document.caretRangeFromPoint = () => {
      const range = document.createRange();
      range.setStart(laterNode, 0);
      range.setEnd(laterNode, 0);
      return range;
    };
    const parent = install();
    window.dispatchEvent(new MessageEvent('message', { data: { type: PLACE_READ } }));
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    const payload = parent.postMessage.mock.calls[0]?.[0] as { type: string; snippet: string };
    expect(payload.type).toBe(PLACE_ANCHOR);
    expect(payload.snippet).toContain('靠近文末的这一节');
    expect(payload.snippet.startsWith('第一段')).toBe(false);
  });

  it('叫它滚到后半段那一句时，滚到那一句，而不是文首', () => {
    const early = document.createElement('p');
    early.textContent = '第一段在最上面。';
    const later = document.createElement('p');
    later.textContent = '靠近文末的这一节还在看。';
    document.body.append(early, later);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value(this: Range) {
        const top = this.toString().includes('靠近文末') ? 640 : 0;
        return {
          top,
          bottom: top + 20,
          left: 0,
          right: 20,
          width: 20,
          height: 20,
          x: 0,
          y: top,
          toJSON() {
            return {};
          },
        };
      },
    });
    install();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: PLACE_RESTORE, snippet: '靠近文末的这一节还在看', ratio: 0 },
      })
    );
    expect(scrollTo).toHaveBeenCalled();
    const top = Number(scrollTo.mock.calls[0]?.[1]);
    expect(top).toBe(640);
    expect(top).toBeGreaterThan(0);
  });
});

describe('measureSourceBox', () => {
  it('行高按字号的倍数算，源码框滚到指定行能读回同一行', () => {
    const pre = document.createElement('pre');
    pre.style.fontSize = '14px';
    pre.style.lineHeight = '1.55';
    pre.style.paddingTop = '16px';
    document.body.appendChild(pre);
    const box = measureSourceBox(pre);
    expect(box.lineHeight).toBeCloseTo(14 * 1.55, 5);
    expect(box.paddingTop).toBe(16);
    pre.remove();
  });
});
