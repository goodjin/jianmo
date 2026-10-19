/**
 * 把导出 HTML 收成预览 iframe 的 srcdoc：外链新窗口打开、去掉正文里的脚本、挂上选择即复制。
 */

import { selectionCopyRuntimeSource } from '../electron/selectionCopy';
import { placeRuntimeSource } from '../electron/viewPlace';

/** 正文可见文字（不含 script/style），用来核对选区是不是文档里的字。 */
export function visibleTextFromHtml(html: string): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    return doc.body?.textContent ?? '';
  } catch {
    return '';
  }
}

function isTrustedPreviewScript(script: Element): boolean {
  const src = script.getAttribute('src') || '';
  const code = script.textContent || '';
  if (code.includes('文档运行时增强')) return true;
  // JSON / JSONL 树：展开收起和点框复制。脚本在正文外面，不能被当成陌生脚本删掉。
  if (code.includes('MARKLY_COPY_BOX')) return true;
  if (code.includes('mermaid.initialize')) return true;
  if (code.length > 8000 && code.includes('mermaid')) return true;
  return /mermaid/i.test(src);
}

/**
 * 预览文档定稿。空字符串原样返回。
 * 已注入过选择即复制脚本时不会再插一次。
 */
export function buildPreviewSrcdoc(html: string): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelector('.content')?.querySelectorAll('script,iframe,object,embed').forEach((node) => {
      node.remove();
    });
    doc.querySelectorAll('script').forEach((script) => {
      if (!isTrustedPreviewScript(script)) script.remove();
    });
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) el.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
    });
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    });
    // 注入也走 DOM：序列化文本里允许出现 "</body>"（如内联 mermaid 包里 DOMPurify 的
    // `+"<body></body></html>"` 字符串），字符串 replace('</body>') 会把脚本插进包中间，
    // 其自带的 </script> 会把大脚本拦腰截断，后半截全部漏成正文文本。
    const host = doc.body ?? doc.documentElement;
    if (!doc.querySelector('script[data-markly-selection-copy]')) {
      const runtime = doc.createElement('script');
      runtime.setAttribute('data-markly-selection-copy', '1');
      runtime.textContent = selectionCopyRuntimeSource();
      host.appendChild(runtime);
    }
    // 桌面预览用来记住阅读位置。只挂在预览 iframe 上，不改导出文件和插件界面。
    if (!doc.querySelector('script[data-markly-place]')) {
      const place = doc.createElement('script');
      place.setAttribute('data-markly-place', '1');
      place.textContent = placeRuntimeSource();
      host.appendChild(place);
    }
    return doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}
