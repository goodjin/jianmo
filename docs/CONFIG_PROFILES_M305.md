# 配置：VS Code Profiles 支持说明（M305）

## 这是什么

VS Code 的 **Profiles（配置文件）** 可以让你在不同场景下使用不同的一组 Settings / UI / Extensions（例如「写作」「开发」「演示」三个 Profile）。

Markly 作为扩展，主要受 **Settings** 影响；因此 Profiles 会自然影响 Markly 的行为。

## Markly 的设置是否会随 Profile 切换？

会。

- Markly 的设置都在 `settings.json` 的 `markly.*` 命名空间下（见扩展设置页）。
- VS Code 在切换 Profile 时，会切换该 Profile 对应的 Settings，Markly 会随之读取最新配置。

常见例子：

- 「写作」Profile：
  - 开启 `markly.editor.defaultForMarkdown`，把 `.md` 默认用 Markly 打开
  - 关闭 AI（默认就关闭）：`markly.ai.rewrite.enabled=false`
  - 偏保守的导出预检：`markly.export.preflight.scope=full`
- 「快速记录」Profile：
  - 允许更激进的导出：`markly.export.preflight.scope=images` 或 `off`
  - 开启/关闭某些编辑体验偏好（字体、换行策略等）

## 密钥（AI API Key）是否随 Profile？

不随。

- Markly 的 AI API Key 存在 VS Code 的 **SecretStorage**（通过命令 `AI: Set API Key` 设置）。
- SecretStorage 属于 VS Code 的安全存储，不在 `settings.json`，所以不会因为 Profile 切换而改变。

建议：

- 如果你想在某个 Profile 里**完全禁用 AI**，请在该 Profile 的 settings 中设置：
  - `markly.ai.rewrite.enabled=false`（默认就是 false）
  - 或者 `markly.ai.rewrite.provider=none`

## Workspace vs User（Profile）优先级

VS Code 的配置有层级（简化版）：

1. Workspace（工作区）设置（`.vscode/settings.json`）
2. User 设置（会被 Profiles 切换）

如果某个工作区强制配置了 `markly.*`，那么即使你切 Profile，也可能仍被 workspace 覆盖。

## 推荐：给团队的 Profile 模板（片段）

下面是一个示例（把它放进某个 Profile 的 Settings JSON；并按你的习惯调整）：

```jsonc
{
  "markly.editor.defaultForMarkdown": true,
  "markly.ai.rewrite.enabled": false,
  "markly.export.preflight.scope": "full",
  "markly.editor.wrapPolicy": "soft",
  "markly.editor.tableCellWrap": "wrap"
}
```

