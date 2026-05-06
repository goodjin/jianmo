# 配置：企业策略文档（受管设置）（M306）

## 目标读者

- 企业 IT / 管理员（希望用统一策略约束扩展行为）
- 团队负责人（希望给团队一个“建议配置基线”）

> 说明：VS Code 对“受管设置（managed settings）”的支持，取决于部署方式（如 Windows 组策略、macOS 配置描述文件、企业镜像等）。Markly 侧的原则是：**所有策略最终都落在 `settings.json` 的 `markly.*` 配置上**。

## 策略设计原则（Markly）

- **隐私优先默认**：AI 默认关闭（`markly.ai.rewrite.enabled=false`），不应在企业场景里“悄悄开启”。
- **离线/内网友好**：导出与预览尽量不依赖外网（例如 Mermaid 策略已默认离线）。
- **可诊断**：遇到失败时用户能复制诊断信息给支持团队。

## 建议的“企业基线配置”（示例）

把下面片段放进企业统一下发的 settings（User 或 Workspace 级别均可，取决于你的管控模型）：

```jsonc
{
  // 1) AI：默认关闭（推荐）
  "markly.ai.rewrite.enabled": false,
  "markly.ai.rewrite.provider": "mock",

  // 2) 导出：开启预检，减少“缺图/坏链”工单
  "markly.export.preflight.scope": "full",
  "markly.export.preflight.blockOnIssues": true,

  // 3) Mermaid：离线优先（已是默认策略；此处显式写出便于审计）
  "markly.export.diagram.mermaidScriptBundling": "embedded"
}
```

## 如果企业允许内网 AI（可选）

若你们有 **内网部署** 的 OpenAI 兼容服务，并经过合规审批，可以在“特定 Profile 或特定 Workspace”里开启：

```jsonc
{
  "markly.ai.rewrite.enabled": true,
  "markly.ai.rewrite.provider": "openai-compatible",
  "markly.ai.rewrite.endpoint": "https://your.internal.endpoint/v1/chat/completions",
  "markly.ai.rewrite.model": "gpt-4o-mini",
  "markly.ai.rewrite.timeoutMs": 15000
}
```

注意：

- API Key 不在 settings 里，而在 SecretStorage（用户通过命令设置）。
- 若企业希望统一下发密钥，应使用企业的凭据分发与安全方案；Markly 不会把密钥写入磁盘配置。

## Workspace 级别强制策略的建议

很多团队希望“只在某个仓库/项目里强制某些行为”。推荐放到仓库的 `.vscode/settings.json`（并纳入版本管理）：

- 例：文档仓库强制默认用 Markly 打开 `.md`

```jsonc
{
  "markly.editor.defaultForMarkdown": true
}
```

## 支持与排障建议

- 用户侧可通过命令获取诊断信息（例如“Export: Copy Last Failure Diagnostics”或 webview 里的“复制诊断信息”入口）
- 建议 IT 侧收集：
  - VS Code 版本
  - Markly 扩展版本
  - 用户当前 Profile 名称（若使用 Profiles）
  - 诊断信息 JSON（可直接转给开发/维护者）

