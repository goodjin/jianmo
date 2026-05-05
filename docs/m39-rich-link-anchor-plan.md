# M39：Rich 链接与锚点（计划）

> **编号备注**：路线图里的「阶段 D · M39」指 **PlantUML 插件化 Spike**，见 [`M39_PLANTUML_PLUGIN_SPIKE.md`](./M39_PLANTUML_PLUGIN_SPIKE.md)。本文专注 **链接 / 锚点 / Wiki** 产品子域。

## 已交付（本期最小）

- 命令 `markly.edit.wrapUrlLink`：当选区为裸 `http(s)://` URL 时包成 Markdown 链接 `[url](url)`（Rich/Source 双路径）。

## 后续

- PM 内编辑已有 link mark、与 TOC 点击编辑态分离。

## Wiki 链 / `[[Page]]`（M25 评估）

- **当前**：未接入 `remark-wiki-link`；用户输入的 `[[...]]` 在 Rich 中按**普通文本**处理，与「不默默改文档」原则一致。
- **`normalizeUrl`**（`webview/src/utils/url.ts`）继续拦 `javascript:`、`data:`、非 http(s) 裸 scheme；单测见 `webview/src/utils/__tests__/url.test.ts`。
- **若未来启用**：需定义解析目标（工作区内文件、标题锚点、外部 URL）与 Source/Rich/导出 **三方一致**，再更新本文件与 [`RICH_SOURCE_PARITY_CHECKLIST.md`](./RICH_SOURCE_PARITY_CHECKLIST.md)。

## 验收

- 扩展命令注册；Webview 对合法 URL 选区替换为链接语法。
