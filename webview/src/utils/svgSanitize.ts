/**
 * M47：粘贴 SVG 时的轻量清理（降低 script / 事件注入风险；非完整 sanitization）。
 */

export function sanitizeSvgMarkup(raw: string): string {
  let t = String(raw ?? '');
  t = t.replace(/<script[\s\S]*?<\/script>/gi, '');
  t = t.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  t = t.replace(/<\s*\?xml[\s\S]*?\?>/gi, '');
  t = t.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  // M135：阻断常见 javascript: 注入（href / xlink:href / src）
  t = t.replace(/\s(?:href|xlink:href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');
  return t.trim();
}
