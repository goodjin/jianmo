import { describe, expect, it } from 'vitest';
import { buildStructuredPreviewHtml } from '../electron/jsonView';
import { SELECTION_COPY_TYPE } from '../electron/selectionCopy';
import { buildPreviewSrcdoc, visibleTextFromHtml } from './previewSrcdoc';

const SAMPLE = `<!DOCTYPE html><html><head><title>t</title></head><body>
<div class="content"><p>你好世界</p><script>parent.postMessage({type:'${SELECTION_COPY_TYPE}',text:'偷来的'},'*')</script>
<a href="https://example.com/a">外链</a><a href="#here" onclick="alert(1)">锚点</a></div>
<script>/* 文档运行时增强（渐进增强） */</script>
<script>evil()</script>
</body></html>`;

describe('visibleTextFromHtml', () => {
  it('只留可见文字，脚本里的字不算正文', () => {
    const text = visibleTextFromHtml('<p>你好</p><script>密码</script><style>.x{}</style>');
    expect(text).toContain('你好');
    expect(text).not.toContain('密码');
  });
});

describe('buildPreviewSrcdoc', () => {
  it('空文档保持空', () => {
    expect(buildPreviewSrcdoc('')).toBe('');
  });

  it('外链新窗口打开，锚点不加 target', () => {
    const out = buildPreviewSrcdoc(SAMPLE);
    const doc = new DOMParser().parseFromString(out, 'text/html');
    const external = doc.querySelector('a[href="https://example.com/a"]');
    expect(external?.getAttribute('target')).toBe('_blank');
    expect(external?.getAttribute('rel')).toContain('noopener');
    expect(doc.querySelector('a[href="#here"]')?.getAttribute('target')).toBeNull();
  });

  it('正文脚本、陌生脚本和点击事件被去掉，导出运行时脚本还在', () => {
    const out = buildPreviewSrcdoc(SAMPLE);
    const doc = new DOMParser().parseFromString(out, 'text/html');
    const codes = [...doc.querySelectorAll('script')].map((s) => s.textContent || '');
    expect(codes.some((code) => code.includes('偷来的'))).toBe(false);
    expect(codes.some((code) => code.includes('evil()'))).toBe(false);
    expect(codes.some((code) => code.includes('文档运行时增强'))).toBe(true);
    expect(doc.querySelector('[onclick]')).toBeNull();
  });

  it('挂上选择即复制，并且只挂一次', () => {
    const once = buildPreviewSrcdoc(SAMPLE);
    expect(once.includes('data-markly-selection-copy')).toBe(true);
    expect(once.split('data-markly-selection-copy').length - 1).toBe(1);
    const twice = buildPreviewSrcdoc(once);
    expect(twice.split('data-markly-selection-copy').length - 1).toBe(1);
  });

  it('挂上记住阅读位置的脚本，并且只挂一次', () => {
    const once = buildPreviewSrcdoc(SAMPLE);
    expect(once.includes('data-markly-preview-drop')).toBe(true);
    expect(once.split('data-markly-preview-drop').length - 1).toBe(1);
    expect(once.includes('data-markly-place')).toBe(true);
    expect(once.split('data-markly-place').length - 1).toBe(1);
    expect(once.includes('MARKLY_PLACE_READ')).toBe(true);
    const twice = buildPreviewSrcdoc(once);
    expect(twice.split('data-markly-place').length - 1).toBe(1);
  });

  it('JSON 树的展开和点框脚本留着，选择即复制也只挂一次', () => {
    const html = buildStructuredPreviewHtml('{"name":"甲","tags":["a"]}', 'json');
    const once = buildPreviewSrcdoc(html);
    const doc = new DOMParser().parseFromString(once, 'text/html');
    const codes = [...doc.querySelectorAll('script')].map((script) => script.textContent || '');
    expect(codes.some((code) => code.includes('MARKLY_COPY_BOX') && code.includes('is-collapsed'))).toBe(true);
    expect(doc.querySelector('.twisty')).not.toBeNull();
    expect(once.split('data-markly-selection-copy').length - 1).toBe(1);

    const twice = buildPreviewSrcdoc(once);
    const again = new DOMParser().parseFromString(twice, 'text/html');
    const codesAgain = [...again.querySelectorAll('script')].map((script) => script.textContent || '');
    expect(codesAgain.some((code) => code.includes('MARKLY_COPY_BOX'))).toBe(true);
    expect(twice.split('data-markly-selection-copy').length - 1).toBe(1);
  });

  it('正文里冒充 JSON 复制的脚本仍然被删掉', () => {
    const html =
      '<html><body><div class="content"><script>MARKLY_COPY_BOX</script><p>正文</p></div><script>evil()</script></body></html>';
    const out = buildPreviewSrcdoc(html);
    const doc = new DOMParser().parseFromString(out, 'text/html');
    const codes = [...doc.querySelectorAll('script')].map((script) => script.textContent || '');
    expect(codes.some((code) => code.includes('MARKLY_COPY_BOX'))).toBe(false);
    expect(codes.some((code) => code.includes('evil()'))).toBe(false);
    expect(doc.body.textContent).toContain('正文');
  });

  it('脚本文本里含 </body> 时（如内联 mermaid 包），选择即复制脚本仍挂在文档尾部，不截断大脚本', () => {
    // 复刻 DOMPurify `_initDocument` 的模式：JS 字符串里带着 "</body></html>"。
    // 脚本带 mermaid.initialize 标记以通过受信检查（长包就是这样被保留下来的）。
    const libCode = 'mermaid.initialize({});var s = "x" + $e + "</body></html>");TAIL_MARKER_LEAK();';
    const html = `<html><head></head><body><div class="content"><p>正文</p></div><script>${libCode}</script></body></html>`;
    const out = buildPreviewSrcdoc(html);
    const doc = new DOMParser().parseFromString(out, 'text/html');

    // 大脚本原样保留，没被插进来的脚本截断
    const codes = [...doc.querySelectorAll('script')].map((s) => s.textContent || '');
    const lib = codes.find((c) => c.includes('TAIL_MARKER_LEAK'));
    expect(lib).toBeDefined();
    expect(lib).toContain('</body></html>');

    // 泄漏金丝雀：TAIL_MARKER_LEAK 若被当成正文渲染出来，visibleTextFromHtml 会看到它
    expect(visibleTextFromHtml(out)).not.toContain('TAIL_MARKER_LEAK');
    expect(visibleTextFromHtml(out)).toContain('正文');

    // 注入脚本都在长脚本之后，没有插进包里面。位置脚本挂在最后，选择即复制仍完整且只有一份。
    const sel = doc.querySelector('script[data-markly-selection-copy]');
    const place = doc.querySelector('script[data-markly-place]');
    expect(sel).not.toBeNull();
    expect(place).not.toBeNull();
    expect(doc.querySelectorAll('script[data-markly-selection-copy]')).toHaveLength(1);
    expect(doc.body.lastElementChild).toBe(place);
    const children = [...doc.body.children];
    const libIndex = children.findIndex((el) => (el.textContent || '').includes('TAIL_MARKER_LEAK'));
    expect(children.indexOf(sel as Element)).toBeGreaterThan(libIndex);
    expect(sel?.textContent).toContain('MARKLY_SELECTION_COPY');
    expect(sel?.textContent).toContain('selectionchange');
  });
});
