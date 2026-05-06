# 本地化（i18n/l10n）架构评估（M271）

> 目标：不强行做完整译稿，但把“未来要做本地化时怎么做”这件事说清楚，避免后续返工。

## 现状

- 扩展侧与 webview 侧均存在中英混合文案（命令标题、提示条、Toast、预检/导出提示等）。
- 近期阶段不引入 breaking，不改变默认行为；本地化应以“文案外置 + 可回退”为主。

## 推荐方案（最小落地路径）

### Extension（Node / VS Code Host）

- 使用 VS Code 推荐的 `vscode-nls`（或官方新机制 `@vscode/l10n`，以当前 VS Code 生态为准）外置字符串。
- `package.json` 中 `contributes.commands[].title`、`markdownDescription` 等可先保持现状；若要全量本地化需在发布流水线引入对应语言包。

### Webview（Vite + Vue）

- 采用 Vue 生态的 i18n（如 `vue-i18n`）或更轻量的 key→string 表（仅满足 UI 文案替换）。
- 关键点：webview 不能依赖 Node 侧 nls 运行时；需要独立加载语言资源。

## 边界与注意事项

- **不承诺翻译质量**：先把架构搭好，让后续可以逐步替换字符串。
- **诊断与错误信息**：建议保留英文关键错误片段（便于搜索与上游报错对齐），并在 UI 上加中文解释。
- **测试**：本阶段只要求“替换不影响功能”；不引入大规模 snapshot 以免维护成本上升。

## 何时推进（建议触发条件）

- Marketplace 用户反馈强烈需要多语言；
- 或 Mid Phase 中 i18n 相关里程碑（见 `docs/ROADMAP_MID.md` 中 i18n 章节）进入实施窗口。

