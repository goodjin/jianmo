/**
 * Rich 粘贴 HTML：需从 DOM 中剥离的标签 selector（追加前请评审安全与会格式影响）。
 * M13：黑名单与 Table 粘贴共用，版本见 `richPasteSanitize.ts`。
 */
export const MARKLY_PASTE_STRIP_SELECTOR =
  'script,style,iframe,object,embed,noscript,meta,link,base,form,template';

export function stripEventHandlerAttributes(el: Element): void {
  const attrs = Array.from(el.attributes);
  for (const a of attrs) {
    const n = String(a.name ?? '').trim();
    if (!n) continue;
    const lower = n.toLowerCase();
    if (lower === 'xmlns' || lower.startsWith('on')) el.removeAttribute(n);
    if (lower.startsWith('javascript:')) el.removeAttribute(n);
  }
}

/** DOM 子树.walk：移除禁止标签节点 + 剥离 on* */
export function hardenPasteDomSubtree(root: ParentNode): void {
  root.querySelectorAll(MARKLY_PASTE_STRIP_SELECTOR).forEach((n) => n.remove());

  root.querySelectorAll('*').forEach((el) => {
    stripEventHandlerAttributes(el);
  });

  stripEventHandlerAttributes(root as Element);
}
