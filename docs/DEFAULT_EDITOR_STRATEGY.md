# M194：默认编辑器策略（建议版）

## 目标

避免强行改变用户习惯：默认编辑器关联属于“用户决定”，Markly 只提供清晰入口与可回退路径。

## 什么时候建议设为默认

- 你主要用 Markly 的 Rich 编辑体验写 Markdown
- 你希望 `.md` 一打开就是所见即所得

## 什么时候不建议设为默认

- 你经常在 `.md` 里写大量代码块并依赖其它扩展的编辑体验
- 你需要与其它 Markdown 扩展协作（lint/preview/diagram 等）

## 如何回退

- 在 VS Code 里对某个 `.md` 文件：
  - 右上角“打开方式/选择编辑器”改回 `Text Editor` 或其它 Markdown 编辑器
- 或在设置里调整文件关联（以 VS Code 的 UI 为准）

## M320：策略落地说明（当前实现）

- **默认行为**：安装后 `.md` 默认使用 Markly（见设置 `markly.editor.defaultForMarkdown`，默认 `true`）。
- **用户可控**：用户可在任意工作区或 Profile 中覆盖该设置，或对单个文件选择其它编辑器。
- **企业/团队**：若需要在某个仓库统一策略，建议放到 `.vscode/settings.json`（见 `docs/ENTERPRISE_POLICY_MANAGED_SETTINGS_M306.md`）。

