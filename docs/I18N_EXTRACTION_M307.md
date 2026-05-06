# i18n：文案外置完成度（M307）

## 目标

让“关键 UI 字符串”不再散落在代码与 `package.json` 中，便于：

- 后续补齐英文/中文语言包（M308）
- 企业/团队可维护统一口径
- 变更时能集中审阅（避免混杂双语、避免遗漏）

## 本次落地（第一步：扩展清单文案）

VS Code 扩展清单（`package.json`）里的文案已开始迁移到 `package.nls*.json`：

- 新增：
  - `package.nls.json`
  - `package.nls.zh-cn.json`
- 已覆盖：
  - `contributes.commands[].title`
  - `contributes.walkthroughs[].title`（部分）
  - `contributes.configuration.title`
  - 多个 `contributes.configuration.properties.*.description`

## 下一步（仍在 M307 内）

- 将剩余的 walkthrough step `description`、设置项的 `markdownDescription`、以及其它可见文案继续迁移进 NLS 文件。
- 扩展运行时（extension host）里的 `showInformationMessage/showWarningMessage` 等字符串，迁移到 `vscode.l10n`（或 `vscode-nls`）统一出口。
- Webview 侧（Vue）引入最小 i18n 机制（不追求复杂框架，优先把硬编码字符串集中到单文件映射）。

