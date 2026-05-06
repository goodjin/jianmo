# 导出主题扩展点（M292）

> 目标：让 HTML/PDF 导出在不改代码的前提下可“换皮”，并明确哪些 CSS 变量/模板 ID 属于稳定扩展面。

## 1. HTML 导出主题

入口：`markly.export.html.theme`

- `default`：屏读友好
- `print-friendly`：偏打印（更紧凑的版心与 `@media print` 规则）

扩展面（稳定）：

- `:root` CSS 变量（背景/文字/代码块/边框/链接色等）
- `@media print` 的表头重复与分页策略

## 2. PDF 导出版式模板

入口：`markly.export.pdf.template`

- `default`：默认
- `academic`：学术风（衬线、印刷色面，标题与 TOC 风格更明显）

扩展面（稳定）：

- `PdfExportTemplateId` 枚举值
- `getPdfHeaderTemplate(template)` / `getPdfTemplateExtraCss(template)` 的输出结构

## 3. 约束与安全

- HTML/PDF 导出均以 **内联 CSS** 为主，避免引入不可信外链。
- Mermaid 的脚本 bundling 受 `markly.export.diagram.mermaidScriptBundling` 控制；离线场景建议 `embedded`。

