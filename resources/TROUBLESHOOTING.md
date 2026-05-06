# Markly 自救与排障

集中入口：命令面板搜索 **「Help: Open Recovery & Troubleshooting」**（`markly.help.recoveryCenter`）可重新打开本文。

## Rich 模式卡顿 / 空白 / 表格异常

1. 若看到顶部提示条「Rich 启动失败/超时，已切换到 Source」，可直接点：
   - **重试 Rich**：无需重开文件即可再试一次
   - **复制诊断信息**：复制一段可直接贴到 Issue 的脱敏信息
   - **重载 Webview**：仅重载当前编辑器页面（不等同于重载 VS Code 窗口）
2. 尝试 **Markly: Toggle Edit Mode** 切到 **Source** 再切回 **Rich**，或重载窗口（**Developer: Reload Window**）。
3. 在设置中关闭 **`markly.editor.enableShiki`** 或 **`markly.editor.enableMermaid`**，大文档可与工具栏 **档位** 提示联动降级。
4. 表格相关：见仓库文档 **Rich 表格** 说明（`docs/RICH_TABLE_USER_GUIDE.md`，源码仓库内）。

## 导出 PDF / HTML 失败

1. 使用 **Export: Copy Last Failure Diagnostics**（`markly.export.copyFailureDiagnostics`）复制脱敏诊断，便于提 Issue。
2. **预检（M224）**：非阻塞提示里可点 **「打开文档并定位」**，在默认 Markdown 编辑器中跳到**首条问题的大概行号**；阻塞预检里选 **「打开文档并定位」** 会先打开文档并**取消本次导出**（修好后再导出一次即可）。
3. 将 **`markly.export.preflight.scope`** 设为 `images` 或 `off` 试是否由预检项引起；检查 **`markly.export.pdf`** / **`markly.export.html`** 各项。
4. PDF 依赖本机可用的 Chromium（Puppeteer）；企业网络或沙箱环境可能拦截浏览器下载或启动。进度通知上可 **取消导出**（best-effort）。

## 大图粘贴 / 剪贴板很慢（M219）

- 高分辨率截图进剪贴板时，扩展会按 **`markly.image.compressThreshold`** / **`markly.image.compressQuality`** 尝试压缩后再落盘；超大图仍可能明显卡顿，属预期成本。
- **建议**：先缩小截图区域、或保存为文件后拖入；弱机可酌情调低质量阈值。

## 图片 / 资产路径

1. 确认 **`markly.image.saveDirectory`** 相对当前 `.md` 文件的路径符合预期。
2. 命令面板中的 **Images:** 系列：缺失引用列表、修复、规范化路径、打开资产目录等。
3. 重命名或移动过图片文件时，扩展可提示 **修复当前文档** 中的引用（需用 Markly 打开该文档）。

## 可选本地遥测（默认关闭）

设置 **`markly.telemetry.enabled`**：为 `true` 时仅在 **Output → Markly Telemetry (local)** 写入匿名计数，**不向第三方发送**。详见设置中的说明。

## 跨平台

路径分隔符、快捷键（macOS `Cmd+\` / Windows Linux `Ctrl+\`）等见随扩展 **`resources/CROSS_PLATFORM.md`**（若已打包）。
