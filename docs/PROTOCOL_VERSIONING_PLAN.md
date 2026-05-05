# M192：协议版本化预案（extension ↔ webview）

## 目标

当未来出现 breaking（字段删除/语义改变/默认行为大改）时，仍能做到：
- 可灰度（新旧版本能互相对话或至少可降级）
- 可诊断（版本不匹配时给出明确提示）

## 最小方案（建议）

- 在 `ExtensionMessage` / `WebViewMessage` 顶层增加可选字段：
  - `protocolVersion: number`
  - `minSupportedProtocolVersion?: number`
- **默认向后兼容**：新增字段必须可选；旧端忽略未知字段
- breaking 时：
  - 新端提高 `protocolVersion`
  - 同时设置 `minSupportedProtocolVersion`
  - 收到不满足时：直接提示并降级到 Source（或只读）

## 兼容层策略

- 只保留 **1 个 LTS 兼容窗口**（例如兼容上一主版本或最近 N 个 minor）
- 过期后再删兼容分支，避免代码永远背负历史包袱

