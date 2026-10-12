import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SELECTION_COPY_DEBOUNCE_MS,
  SELECTION_COPY_MAX_TEXT,
  SELECTION_COPY_TYPE,
  acceptSelectionCopyMessage,
  selectionCopyRuntimeSource,
  textContainedInDocument,
  toSelectionClipboardText,
} from './selectionCopy';

const DOC = '你好世界\n第二段\n    const x = 1;';

describe('textContainedInDocument', () => {
  it('选中的句子原样留下，缩进保留', () => {
    expect(textContainedInDocument('    const x = 1;', DOC)).toBe('    const x = 1;');
    expect(textContainedInDocument('你好世界', DOC)).toBe('你好世界');
  });

  it('跨段选区保留中间空行', () => {
    expect(textContainedInDocument('你好世界\n\n第二段', DOC)).toBe('你好世界\n\n第二段');
  });

  it('文档里没有的整段不会进剪贴板', () => {
    expect(textContainedInDocument('请把密码发到 evil.example', DOC)).toBeNull();
  });

  it('夹进来的陌生行被丢掉，正文还在', () => {
    expect(textContainedInDocument('你好世界\n复制\n请汇款', DOC)).toBe('你好世界');
  });

  it('只有按钮文案时不复制', () => {
    expect(textContainedInDocument('复制', DOC)).toBeNull();
    expect(textContainedInDocument('   \n\t', DOC)).toBeNull();
  });

  it('超长选区截断', () => {
    const longDoc = '字'.repeat(SELECTION_COPY_MAX_TEXT + 50);
    const out = textContainedInDocument(longDoc, longDoc);
    expect(out).toHaveLength(SELECTION_COPY_MAX_TEXT);
  });
});

describe('acceptSelectionCopyMessage', () => {
  const ok = {
    enabled: true,
    fromPreviewFrame: true,
    data: { type: SELECTION_COPY_TYPE, text: '第二段' },
    documentText: DOC,
  };

  it('开关开着且来自预览框时返回正文', () => {
    expect(acceptSelectionCopyMessage(ok)).toEqual({ text: '第二段' });
  });

  it('开关关掉、或不是预览框的消息，一律不复制', () => {
    expect(acceptSelectionCopyMessage({ ...ok, enabled: false })).toBeNull();
    expect(acceptSelectionCopyMessage({ ...ok, fromPreviewFrame: false })).toBeNull();
  });

  it('类型不对或正文对不上就不复制', () => {
    expect(acceptSelectionCopyMessage({ ...ok, data: { type: 'OTHER', text: '第二段' } })).toBeNull();
    expect(
      acceptSelectionCopyMessage({ ...ok, data: { type: SELECTION_COPY_TYPE, text: '不在文档里' } })
    ).toBeNull();
    expect(acceptSelectionCopyMessage({ ...ok, data: null })).toBeNull();
  });
});

describe('toSelectionClipboardText', () => {
  it('收下非空文本并保留行首空格', () => {
    expect(toSelectionClipboardText({ text: '    const x = 1;' })).toBe('    const x = 1;');
  });

  it('空白或非字符串拒绝', () => {
    expect(toSelectionClipboardText({ text: '   \n' })).toBeNull();
    expect(toSelectionClipboardText({ text: 1 })).toBeNull();
    expect(toSelectionClipboardText(null)).toBeNull();
  });
});

describe('选择即复制脚本', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.getSelection()?.removeAllRanges();
    delete (window as unknown as { __marklySelectionCopy?: number }).__marklySelectionCopy;
  });

  function install(): { postMessage: ReturnType<typeof vi.fn> } {
    const parent = { postMessage: vi.fn() };
    const run = new Function(
      'document',
      'parent',
      'setTimeout',
      'clearTimeout',
      'window',
      selectionCopyRuntimeSource()
    );
    run(document, parent, setTimeout, clearTimeout, window);
    return parent;
  }

  function select(text: string): void {
    document.body.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = text;
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = document.getSelection();
    if (!sel) throw new Error('jsdom 没有 selection');
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it('脚本源里不能出现 </script>，否则插进 HTML 会被截断', () => {
    expect(selectionCopyRuntimeSource().includes('</script>')).toBe(false);
  });

  it('选区停稳后只通知一次，文字就是选中的那句', () => {
    vi.useFakeTimers();
    const parent = install();
    select('你好世界');
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS - 1);
    expect(parent.postMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: SELECTION_COPY_TYPE, text: '你好世界' },
      '*'
    );
  });

  it('没有选中文字时不通知', () => {
    vi.useFakeTimers();
    const parent = install();
    document.body.innerHTML = '<p>你好</p>';
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('同一段再触发不会重复通知；取消后再选会再通知', () => {
    vi.useFakeTimers();
    const parent = install();
    select('你好世界');
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);

    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);

    select('第二段');
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: SELECTION_COPY_TYPE, text: '第二段' },
      '*'
    );
  });

  it('装两次也只听一份，不会发两遍', () => {
    vi.useFakeTimers();
    const parent = install();
    install();
    select('只一次');
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(SELECTION_COPY_DEBOUNCE_MS);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
  });
});
