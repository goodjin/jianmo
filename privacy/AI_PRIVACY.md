# Markly 写作辅助（AI）与隐私 / 数据流向

面向最终用户：**默认不会把你的整篇笔记自动上传到任何模型服务**；只有在你主动操作且完成配置之后，才把**明示范围内的文本**发往你自选的服务器。

---

## 三句话（可复述给同事）

1. **默认关**：扩展设置里 **`markly.ai.rewrite.enabled` 默认为关闭**，未开启时整条 AI 辅助链路不会向你的 Endpoint 发起请求。  
2. **默认不写公网**：同项下 **`markly.ai.rewrite.provider` 默认为 `mock`**，为本地占位/规则演示，不进公网 HTTP。  
3. **点对点、你触发**：切换到 **`openai-compatible`** 并完成 Endpoint / 密钥后，**只有在你点击某次 AI 能力（如下表）**，对应内容才会随同该次 HTTPS 请求离开本机发往你配置的地址；密钥存入 **VS Code SecretStorage**，**不会写入 `settings.json`**。

详见命令面板：**「AI: Open Privacy Notice」（`markly.ai.openPrivacyNotice`）** — 可随时打开本文。

---

## 不会自动上传「全文」的默认含义

「默认不上传全文」指：**安装后开箱配置下**，扩展既未开启 AI，也不会在后台静默同步文档。即使有「摘要」等功能，也需你**额外打开开关**并选对 provider。

注意：一旦你启用开放 AI Endpoint，并使用侧栏摘要里的 **「全文」**，那一次操作会传入**当前 Buffer 内的整篇 Markdown**（见下表）。这是 **显式操作**，不是静默同步。

---

## 各能力与出站数据范围（启用 `openai-compatible` 且 AI 开关为 ON 时）

| 能力与入口 | 离开本机的典型负载 | 备注 |
|-----------|-------------------|------|
| 侧栏 **摘要 → 全文** | **当前编辑器中的完整 Markdown** | `Scope=document` |
| 侧栏 **摘要 → 当前节** | **由大纲高亮推导出的单节 Markdown**（无定位则为空） | `Scope=section` |
| **标题建议** | 文档开头至多约 **8000 字符** 的 Markdown 片段 | 用于生成候选题目 |
| **选区润色**（确认前预览） | **当时选中的纯文本/Markdown 选区** | 与选区长度一致 |
| **选区转 GFM 表格（AI）** | **那时选中的表格意向文本（如 TSV/CSV）** | 确认后才写回编辑器 |
| 命令 **Writing: Insert Local Summary** | **无**。纯本地摘要插入 | 与 AI Provider 无关 |
| **`mock` / `none` provider** | **无远端请求**（或功能按实现直接禁用） | 默认 `mock` |

Provider 侧的日志、留存与合规 **由你与该 Endpoint 的运营方约定**（公司网关、私有化部署、公有云 API 各不相同）。若文档含密钥、身份证号等敏感信息，**请勿**发往不可信 Endpoint。

---

## API Key 与配置存哪儿

- **API Key**：通过命令 **AI: Set API Key** 写入 VS Code **`SecretStorage`**，仅本环境加密存储界面管理。  
- **Endpoint / 模型 / 超时**：在 **用户/工作区设置** 里的 `markly.ai.rewrite.*` 可读，但 **不含密钥原文**。

---

## 自检与变更记录

- 修改 Endpoint 或 Provider 后，建议跑一次 **AI: Validate Setup**。  
- 扩展版本演进见仓库根目录 **`CHANGELOG.md`**；本说明随扩展包附带，版本以安装包为准。

---

## 联系与开源

如对本文有法务/合规增补需求，欢迎通过 **[Issues](https://github.com/goodjin/jianmo/issues)** 提出。源代码与构建说明参见仓库 **`README.md`**。
