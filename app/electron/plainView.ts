/**
 * 普通文本的预览：原样放进等宽的 pre，不按 Markdown 排。
 * 尖括号先转义，网页和脚本文件不会在预览里执行。
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPlainPreviewHtml(content: string): string {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  pre.plain-text {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    line-height: 1.55;
  }
</style>
</head>
<body>
<div class="content"><pre class="plain-text">${escapeHtml(text)}</pre></div>
</body>
</html>`;
}
