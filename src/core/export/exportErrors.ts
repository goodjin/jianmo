/**
 * 将导出链路异常转换为用户可读文案（M₄₄：失败归因）。
 */
export function formatExportFailure(format: 'pdf' | 'html' | string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('export cancelled')) {
    return `导出已取消。若卡住过久，可先关闭进度通知再试。`;
  }

  if (format === 'pdf') {
    if (lower.includes('failed to launch') || lower.includes('browser') || lower.includes('chromium')) {
      return `PDF 导出失败：无法启动内置 Chromium（Puppeteer）。请在允许启动子进程的环境中重试，或检查安全软件是否拦截。\n详情：${raw}`;
    }
    if (lower.includes('timeout') || lower.includes('networkidle') || lower.includes('timed out')) {
      return `PDF 导出失败：页面加载或渲染超时，可能与外链、大图或复杂公式有关。可稍后重试或简化文档后导出。\n详情：${raw}`;
    }
    if (lower.includes('enoent') || lower.includes('no such file')) {
      return `PDF 导出失败：输出路径无效或磁盘不可写。\n详情：${raw}`;
    }
    if (lower.includes('eacces') || lower.includes('eperm') || lower.includes('permission denied')) {
      return `PDF 导出失败：当前环境无权限写入目标路径（或被安全软件拦截）。请换目录或以可写权限重试。\n详情：${raw}`;
    }
    if (lower.includes('enospc') || lower.includes('no space left')) {
      return `PDF 导出失败：磁盘空间不足，请清理后重试。\n详情：${raw}`;
    }
    return `PDF 导出失败：${raw}`;
  }

  if (format === 'html') {
    if (lower.includes('enoent') || lower.includes('no such file')) {
      return `HTML 导出失败：输出路径无效或磁盘不可写。\n详情：${raw}`;
    }
    if (lower.includes('eacces') || lower.includes('eperm') || lower.includes('permission denied')) {
      return `HTML 导出失败：当前环境无权限写入目标路径。请换目录或以可写权限重试。\n详情：${raw}`;
    }
    if (lower.includes('enospc') || lower.includes('no space left')) {
      return `HTML 导出失败：磁盘空间不足，请清理后重试。\n详情：${raw}`;
    }
    return `HTML 导出失败：${raw}`;
  }

  return `导出失败：${raw}`;
}
