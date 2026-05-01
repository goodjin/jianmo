# M36：Rich 查找/替换与链接闭环

## 目标

- **查找**：命令面板可开关查找替换面板；Rich/Source 行为一致；`Ctrl/Cmd+F` 继续在当前实现下打开面板（由 Webview 全局监听处理）。
- **链接**：Rich 下 `Mod+K` / 插入链接命令与工具栏一致；有选区时用选区文字作为链接锚文本，默认 `https://example.com`，与 Source 下“选区优先”的体验对齐（Source 仍保留地址输入对话框）。

## 任务拆分

| ID | 内容 |
|----|------|
| M36-0 | 本计划文档 |
| M36-1 | `App.vue`：`Mod+K` 在 Rich 下不再被 `milkdownFocused` 短路，统一走 `handleInsert('link')` |
| M36-2 | `MilkdownEditor.vue`：`insertNode('link')` 非空调选区 → `[escaped](https://example.com)` |
| M36-3 | 查找面板：`FindReplacePanel` 已有打开时聚焦查找框；`toggleFindReplace` 切换可见性 |
| M36-4 | 扩展：`EDITOR_COMMAND.toggleFindReplace`；`markly.find.toggle`；webview 处理 |
| M36-5 | 路线图、契约测试、发版 PATCH |

## 验收

- 协议样例通过 `isExtensionMessage`。
- Rich 中选中文本后插入链接，锚文本为选中内容。
- 命令面板 “Find: Toggle Find and Replace Panel” 可切换面板。
