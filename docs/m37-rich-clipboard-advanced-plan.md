# M37：Rich 剪贴板进阶

## 目标

- **纯文本粘贴**：`Mod+Shift+V` 在 Rich 内将剪贴板 `text/plain` 直接写入选区（不经过 Markdown 解析）；命令 `markly.edit.pastePlain` 对 Rich/Source 均可用（异步读剪贴板后替换选区）。
- **代码块**：光标在 `code_block` 内时，普通粘贴仅插入纯文本，避免富文本/HTML 混入代码结构。
- **HTML 清理**：表格粘贴矩阵解析前对剪贴板 HTML 做轻量清理（移除 `script`/`style`/`iframe`/`object`/`embed`），再交给 `parseHtmlTableToGrid`。
- **诊断**：复制诊断信息中包含 `richClipboard` 能力快照，便于反馈剪贴板相关环境问题。

## 任务拆分

| ID | 内容 |
|----|------|
| M37-0 | 本计划文档 |
| M37-1 | `marklyPastePlainShortcutPlugin` + `pastePlainAtSelection` |
| M37-2 | `handlePaste` 首段检测 `code_block` → `insertText(plain)` |
| M37-3 | `sanitizeClipboardHtmlForTableParse` + `parseTablePasteMatrix` 接入 |
| M37-4 | 诊断 `extra.app.richClipboard`；单测 sanitize/parse |
| M37-5 | 路线图、版本与门禁 |

## 验收

- 单测：`sanitizeClipboardHtmlForTableParse` + `parseTablePasteMatrix` 含脚本噪声的 HTML 仍能解析出表格。
- Source 模式命令粘贴纯文本可替换选区（依赖 webview 剪贴板权限）。
