# Preview 导出 vs 正式导出（M259）

本仓库有两条“导出 HTML”的入口：

1. **Preview: Export HTML (read-only)**（`markly.preview.exportHtml`）  
2. **Export as HTML**（`markly.export.html`）

## 它们的共同点

- 复用同一套核心导出逻辑（Markdown → HTML、Mermaid、主题 CSS 等）。
- 都会受 `markly.export.*`、`markly.image.*` 等设置影响（详见 `docs/EXPORT_GUIDE.md`）。

## 它们的差异（为什么会有两条）

- **Preview 导出**：用于“先看看导出的 HTML 长什么样 / 做模板排版核对”。  
  - 常见实现差异：为了在 VS Code Webview 里预览，本地图片/资源可能被重写为 webview 可读的 URI。
- **正式导出**：用于“把文件写到磁盘并发给别人/归档”。  
  - 会严格以磁盘路径为准，必要时按配置复制本地图片（`copyLocalImages`）。

## 排障建议

- 若 **Preview 正常但正式导出失败**：多半是磁盘权限/路径/图片复制相关，优先看 `resources/TROUBLESHOOTING.md` 的导出章节并复制导出失败诊断包。
- 若 **正式导出正常但 Preview 异常**：多半是 webview 资源重写/受限，建议先升级 VS Code 与扩展，并附 webview 诊断包。

