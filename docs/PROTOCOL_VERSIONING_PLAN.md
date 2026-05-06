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

## M322：版本演进计划（建议落地口径）

### 版本号语义

- `protocolVersion`：当前端（extension / webview）实现的协议版本号
- `minSupportedProtocolVersion`：仍然愿意兼容的最小版本号

### 升级/降级行为

1. **新端 ↔ 旧端仍可通讯**（最理想）：
   - 新增字段保持可选
   - 旧端忽略未知字段
2. **无法兼容时（breaking）**：
   - 新端提高 `protocolVersion`，并设置 `minSupportedProtocolVersion`
   - 运行时检测到对端版本不满足时：
     - 给出明确提示
     - **自动降级到 Source**（或只读），确保用户至少能编辑/保存

### 兼容窗口建议

- 建议以“最近 N 个 minor（例如 3–6 个）”作为兼容窗口
- 每次发版在 `CHANGELOG` 或兼容文档里明确“支持窗口”


