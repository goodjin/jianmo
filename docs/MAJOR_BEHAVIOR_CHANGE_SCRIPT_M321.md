# 文档：重大行为变更剧本（M321）

## 适用场景

当我们要做“会改变用户习惯/默认行为”的变更时（例如：改变 `.md` 默认编辑器策略、改变 Rich/Source 默认模式、协议 breaking），必须按本剧本推进，避免线上混乱。

## 变更前（设计与评审）

- 明确变更类型：
  - **默认值改变**（settings 默认、首次安装体验）
  - **协议/数据结构变更**（extension ↔ webview message）
  - **行为语义改变**（同样输入输出不同）
- 写出：
  - 用户影响面（谁会受影响、怎么受影响）
  - 可回退路径（用户侧如何恢复旧体验；发布侧如何回滚）
  - 兼容窗口（至少覆盖上一稳定版本或最近 N 个 minor）
- 对齐参考文档：
  - `docs/DEFAULT_EDITOR_STRATEGY.md`
  - `docs/PROTOCOL_VERSIONING_PLAN.md`
  - `docs/M100-2.0-GATE.md`（如涉及 breaking）

## 实施中（工程门禁）

- **代码门禁**：`npm run gates:stable` 必须通过
- **兼容门禁**：新增 message 字段必须可选；老端忽略未知字段
- **可诊断**：失败必须能复制诊断信息（导出/启动/兼容都一样）

## 发布时（沟通与说明）

- 更新：
  - `CHANGELOG.md`（Breaking/行为变化口径）
  - `resources/TROUBLESHOOTING.md`（用户自救路径）
  - README / Marketplace（如需要）
- 需要时给出“迁移小抄”：
  - 配置项怎么改
  - 一键回退怎么做

## 发布后（观察与止血）

- 明确观察窗口（例如 48h / 7d）
- 若出现高频问题：
  - 优先 patch 修复
  - 或回滚到上一版 VSIX（见 `docs/RELEASE_PLAYBOOK_M316.md`）

