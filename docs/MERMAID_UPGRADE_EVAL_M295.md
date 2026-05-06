# Mermaid 升级评估（M295）

## 现状（升级前）

- webview：`webview/package.json` 固定 `mermaid@11.12.3`
- extension：`package.json` 依赖 `mermaid@^11.12.3`
- 导出 CDN 常量：`src/core/export/mermaidExport.ts` 写死 `11.12.3`

## 目标版本（2026-05）

- Mermaid 最新：**11.14.0**（2026-04-01）
- 本次评估结论：**可升级到 11.14.0**（单测全绿；主要变更为新增图表与内部修复）

## 关键变更点（需要关注）

- **11.13.0**：
  - flowchart 纯文本标签回归纯文本（不再默认按 Markdown 解释）；如需 Markdown 需显式语法包装（见官方 release note）。
  - `flowchart.htmlLabels` 被弃用，推荐使用根级 `htmlLabels`。

- **11.14.0**：
  - 修复多图渲染时 SVG 内部 ID 冲突：内部 element ID 将被加前缀。
    - 影响面：如果用户/模板用 `#arrowhead` 这类精确 ID 选择器，需改为 `[id$="-arrowhead"]`（本仓库未发现此类依赖）。

## 本仓库改动与兼容策略

- 依赖升级：
  - `webview/package.json`：`mermaid 11.12.3 -> 11.14.0`
  - `package.json`：`mermaid ^11.12.3 -> ^11.14.0`
  - `src/core/export/mermaidExport.ts`：CDN 常量同步到 `11.14.0`

- 配置清理：
  - webview 侧 Mermaid 初始化改为使用根级 `htmlLabels: true`，避免 `flowchart.htmlLabels` 弃用路径。

## 验证

- `npm test`（根 + webview）通过。

## 回滚策略

- 回滚依赖版本到 11.12.3（两处 package.json + CDN 常量）。

