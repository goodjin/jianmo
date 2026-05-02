# M38：Rich 查找/替换深化（计划）

## 范围

- 命令面板驱动「下一个/上一个」与面板按钮一致；打开查找面板（若未开）。
- 正则/通配非法模式在 UI 层可见提示，避免静默无匹配。
- 替换后 Rich 维持 `richFindAnchor` 与一次 `queueRichFocus`（与 Content 同步节奏一致）。

## 验收

- `EDITOR_COMMAND.findNavigate` + `markly.find.next` / `markly.find.previous`。
- Find 面板在 regex 模式下显示模式错误提示（若无法编译正则）。

## Out of scope（后续）

- 虚拟化匹配列表、离屏百万次替换进度条。
