# M43：图片资产进阶（计划）

## 已交付（本期）

- 命令 `markly.image.batchReplaceInDocument`：宿主输入「旧子串」「新子串」，经 `EDITOR_COMMAND.documentReplace` 在当前 Webview 全文替换（用于移动/改名后批量修引用）。

## 后续

- `onDidRenameFiles` 自动提示、粘贴覆盖策略 UI。

## 验收

- 契约测试覆盖 `documentReplace`；扩展命令可达。
