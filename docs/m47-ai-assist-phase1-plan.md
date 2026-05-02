# M47：AI 写作辅助第一期（Mock）

## 已交付（本期）

- `writingAssist: 'rewriteSelection'`：读取选中文本（Rich PM / CM6），**本地 Mock** 润色（不发起网络）。
- 工作区：`markly.ai.rewrite.enabled`（默认 `false`，开启后命令才替换选区）。
- `markly.assist.rewriteSelection` → `postEditorCommand`。

## 后续

- SecretStorage API Key、`fetch` 走扩展宿主、`AbortController` 超时。

## 验收

- `rewriteSelection` Guard + Webview handler 测试（开启 mock 时对选区有可见变更）。
