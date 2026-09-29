/**
 * 标题锚点的权威实现（跨侧契约）。
 *
 * 三处消费方必须与本模块一致，否则「目录/大纲点击跳转」会指不到目标：
 * 1. 导出 HTML / Preview iframe / 桌面端预览里的 heading.id（htmlExport.addHeadingAnchors）；
 * 2. webview 大纲 / Rich / 悬停预览（webview/src/shared/outline.generateHeadingId / headingNodeId）；
 * 3. 桌面端大纲（app/renderer/PreviewApp.vue）。
 *
 * 契约（按优先级）：
 * - `{#custom-id}` 自定义锚点优先；
 * - 其次是可见文本的 slug：保留中文、剥掉行内标记、折叠连续连字符、去掉首尾连字符；
 * - 都拿不到时按标题出现序号兜底 `markly-h-{n}`。
 */

/** `{#custom-id}` 自定义锚点；无则返回 undefined。 */
export function extractCustomHeadingId(text: string): string | undefined {
  const m = String(text ?? '').match(/\{#([^}]+)\}/);
  const id = (m?.[1] ?? '').trim();
  return id ? id : undefined;
}

/** 去掉标题尾部 `{#custom-id}` 标记后的可见文本（标题渲染、目录标签、大纲文案共用）。 */
export function stripCustomIdToken(text: string): string {
  return String(text ?? '')
    .replace(/\s*\{#[^}]+\}\s*$/, '')
    .trim();
}

/** 行内 Markdown → 纯文本（锚点与目录标签共用）。 */
export function stripInlineMarkup(text: string): string {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1');
}

/**
 * 标题锚点 slug：与 webview 大纲 / Rich / 悬停预览一致
 * （保留中文、折叠连续连字符、去掉首尾连字符），保证目录与预览跳转可用。
 */
export function headingSlug(text: string): string {
  return stripInlineMarkup(stripCustomIdToken(text))
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 标题的稳定 id：自定义 `{#id}` 优先，其次 slug，兜底按出现序号。 */
export function headingAnchor(text: string, fallbackIndex: number): string {
  return extractCustomHeadingId(text) || headingSlug(text) || `markly-h-${fallbackIndex}`;
}
