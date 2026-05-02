# M44：导出 HTML 主题（计划）

## 已交付（本期）

- 工作区配置 `markly.export.htmlTheme`：`default` | `print-friendly`。
- `exportToHtml` / `buildHtmlDocument` 接受主题并调整版心、打印 `@media print` 基础样式。

## 后续

- PDF 分页回归扩展、TOC 开关配置下发 Webview。

## 验收

- `htmlExport` 单元测试快照或字符串断言包含 print 特有 class/CSS。
