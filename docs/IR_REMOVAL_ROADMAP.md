# M191：IR 移除路线图（建议版）

## 背景

IR（`EditorMode='ir'`）已冻结：不再新增能力，仅允许修复阻断性回归。目标是在 Rich/Source 覆盖面足够时移除 IR 相关代码与配置，降低维护成本。

## 移除条件（门槛）

满足以下条件即可进入“移除阶段”：

- **编辑能力覆盖**：Rich/Source 已覆盖主要编辑路径（标题/列表/引用/表格/图片/链接/撤销/复制粘贴）
- **导出能力覆盖**：PDF/HTML 导出不依赖 IR
- **稳定性门禁通过**：`npm run gates:stable` 连续通过（至少 3 次，避免偶发）
- **兼容策略**：extension↔webview 消息仍可向后兼容，或已声明 breaking 并准备迁移说明

## 分阶段计划

### Phase 0：冻结期（现在）
- 只修阻断性 bug
- 文档强调“Rich 为主，Source 兜底”，IR 仅兼容存在

### Phase 1：软下线（建议：1–2 个小版本）
- UI 入口隐藏 IR（若仍存在）
- telemetry/诊断中将 IR 标记为 `legacy-ir`
- 保留协议字段但不再提供切换入口

### Phase 2：移除实现（建议：后续一个小版本）
- 删除 webview IR decorators 与相关开关
- 删除 `EditorMode='ir'` 的运行路径（保留类型兼容层或迁移）

### Phase 3：清理协议与类型（若需要 2.0）
- 若移除导致协议/默认行为 breaking，则纳入 2.0 决策清单（见 M198）

---

## 2.0 版本目标（方向确认）

**Markly 2.0** 将把「完全移除 IR」列为正式交付范围之一：

- **`EditorMode` 仅保留** `rich` | `source` | `preview`（与用户可见的三种模式一致）。
- **代码与契约**：删除 IR  decorators、快捷键/消息运行路径中对 `'ir'` 的分支；`src/types`、`messageGuards`、webview 中与 IR 并列的死代码一并清理。
- **数据迁移**：历史上 `workspaceState`、设置或会话里若仍为 `ir`，打开时须有明确降级策略（例如统一落到 `source`，并写入新状态）。
- **版本语义**：破坏性移除配套 **语义化 MAJOR（2.0.0）**；迁移说明与弃用预热见 `docs/M200-2.0-GONOGO.md`、`docs/ROADMAP_FAR.md`（M362–M368 闸门）。

Phase 1–2 仍可在 **1.x** 内持续推进（隐藏入口、删实现冗余）；Phase 3 中与协议/类型不可分割的收口与 **2.0 发包**对齐执行。

