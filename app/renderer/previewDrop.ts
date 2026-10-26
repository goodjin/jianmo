/**
 * 预览画在沙箱 iframe 里。文件拖到正文上时，父页面收不到 drop。
 * 这段脚本在预览文档里接住，再把路径交出来。读不到路径时不拦，交给外层导航兜底。
 */

export const PREVIEW_DROP = 'MARKLY_PREVIEW_DROP';

export interface PreviewDropFile {
  path: string;
  name: string;
}

export function previewDropRuntimeSource(): string {
  return `(function(){
  if (window.__marklyPreviewDrop) return;
  window.__marklyPreviewDrop = 1;
  function filesOf(ev) {
    var list = ev.dataTransfer && ev.dataTransfer.files;
    var items = [];
    if (!list) return items;
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      var filePath = file && typeof file.path === 'string' ? file.path : '';
      if (!filePath) continue;
      items.push({ path: filePath, name: file.name || '' });
    }
    return items;
  }
  window.addEventListener('dragover', function(ev) {
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    ev.preventDefault();
  });
  window.addEventListener('drop', function(ev) {
    var items = filesOf(ev);
    if (!items.length) return;
    ev.preventDefault();
    parent.postMessage({ type: ${JSON.stringify(PREVIEW_DROP)}, files: items }, '*');
  });
})();`;
}

export function readPreviewDropFiles(data: unknown): PreviewDropFile[] | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { type?: unknown; files?: unknown };
  if (record.type !== PREVIEW_DROP) return null;
  if (!Array.isArray(record.files)) return null;
  const out: PreviewDropFile[] = [];
  for (const item of record.files) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { path?: unknown; name?: unknown };
    const path = typeof row.path === 'string' ? row.path : '';
    const name = typeof row.name === 'string' ? row.name : '';
    if (!path && !name) continue;
    out.push({ path, name });
  }
  return out;
}
