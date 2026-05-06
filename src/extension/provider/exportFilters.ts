/**
 * VS Code SaveDialog 的文件类型过滤器（与 {@link vscode.window.showSaveDialog} 对齐）。
 */
export function getExportFilters(format: string): { [key: string]: string[] } {
  const filters: { [key: string]: string[] } = {
    markdown: ['md', 'markdown'],
    html: ['html'],
    pdf: ['pdf'],
    json: ['json'],
  };
  return { [format.toUpperCase()]: filters[format] || ['*'] };
}
