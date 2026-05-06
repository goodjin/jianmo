# 剪贴板：富文本/图片粘贴边界加固（M325）

## 目标

让“粘贴”在复杂来源（浏览器/Excel/邮件/IM）下更稳定、可控、可诊断：

- 富文本粘贴不会把危险/无效 HTML 带进编辑器
- 表格粘贴在超大输入时可截断/拒绝（避免卡死）
- 图片粘贴对超大图有压缩策略与可预期成本

## 当前仓库已具备的防护点（证据）

- **表格粘贴 HTML 清洗**：`sanitizeClipboardHtmlForTableParse`（见 `webview/src/plugins/markly-table-rich.ts` 与对应单测）
- **超限策略**：表格 paste 有 row/col/cell 上限与 over_limit 分支（对应大量单测）
- **纯文本粘贴命令**：`markly.edit.pastePlain` → webview `pastePlainAtSelection()`（读 `navigator.clipboard.readText`，失败会 warn）
- **图片粘贴压缩策略**：受 `markly.image.compressThreshold` / `markly.image.compressQuality` 控制（见 `resources/TROUBLESHOOTING.md`）

## 统一排障口径

当用户反馈“粘贴异常/卡死/乱码”：

1. 优先让用户尝试 **纯文本粘贴**（命令：Edit: Paste as Plain Text）
2. 复制诊断信息（webview diagnostics 包）
3. 若是表格：提供最小可复现输入（TSV/HTML片段）

