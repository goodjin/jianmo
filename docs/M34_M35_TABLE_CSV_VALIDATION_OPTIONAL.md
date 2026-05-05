# M34 / M35 — CSV 列映射与列校验（延后 / 可选）

按 [`plan-ir-freeze-100MS-task-split.md`](./plan-ir-freeze-100MS-task-split.md)：**M34**（CSV 导入列映射 UI）、**M35**（可选列校验 + 扩展元数据）均为 **可选** 条目，牵涉新面板、`package.json` 配置与持久化字段设计。

当前版本 **不交付**交互式列映射或默认开启的校验；粘贴矩阵仍沿用 `markly-table-rich` 的**行 / 列 / 格子上限与确认**策略。

后续若立项：须先冻结「表格元数据存 Markdown 注释还是并排 sidecar JSON」再行开发。
