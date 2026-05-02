# M40：大纲当前章节（计划）

## 已交付（本期）

- Rich：滚动 Milkdown 容器时用「视口上位标题」启发式更新大纲高亮。
- Source/IR：光标变化时按文档偏移映射到最近上方标题 slug。
- 折叠状态：`vscode.setState` / `getState` 持久化 `outlineCollapsedIds`（每 Webview 实例即每文档）。

## 验收

- 大纲 `.active` 随滚动/光标变化更新；折叠在重载 Webview 后保持。
