# 导出：失败诊断 UX 统一与自救入口（M324）

## 目标

当导出失败时，用户不用“猜”，而是始终能看到一致的自救入口：

- 一键复制脱敏诊断包
- 明确下一步（预检/配置/网络/Chromium）

## 当前实现（已具备）

- 导出失败会弹出错误提示，并提供 **「复制诊断包」**：
  - 实现：`src/extension/export/exportFailureUi.ts`
- 命令面板提供 **Export: Copy Last Failure Diagnostics**：
  - 实现：同上（复用最近一次失败的诊断包）
- 诊断包内容（Markdown）由 core 侧统一生成并做路径脱敏：
  - `src/core/export/exportDiagnostics.ts`

## 统一口径（用户视角）

1. 导出失败 → 点 **复制诊断包** → 贴到 Issue/工单
2. 若关闭了弹窗 → 运行命令 **Export: Copy Last Failure Diagnostics**

## 后续可选增强（不阻塞）

- 对 PDF 失败补一个更明确的“Chromium/Puppeteer 常见原因”提示链接到 `resources/TROUBLESHOOTING.md`
- 在失败弹窗中补一个“打开自救中心”入口（统一到 help 中枢）

