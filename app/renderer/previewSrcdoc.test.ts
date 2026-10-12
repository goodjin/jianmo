import { describe, expect, it } from 'vitest';
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
});
