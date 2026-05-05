# M36：Mermaid 版本策略

## Pin 规则

- **Webview 依赖**：[`webview/package.json`](../webview/package.json) 中 `mermaid` 使用 **精确版本**（无 `^`/`~`），与锁文件一致，避免编辑器与 CI 上出现「同一天两个 patch 行为不同」。
- **升级**：发版时在 `CHANGELOG.md` **Added/Changed** 中写明 Mermaid 大/小版本与已知破坏性（可查 [Mermaid releases](https://github.com/mermaid-js/mermaid/releases)）。

## 运行时

- 仍通过 **动态 `import('mermaid')`** 加载（见 `MilkdownEditor.vue`、`DiagramRenderer.vue`），不改变打包分割策略。
- **M37/M38**：版本 pin 与「渲染代际取消」「离线占位」正交；升级后须跑一遍 `npm test` + Rich 大图档手工烟测。
