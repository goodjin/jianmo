# Mid Go/No-Go 记录（M344）

## 决策问题

中期阶段收口后，下一步是：

- **Go：进入 Far Phase（M361+）**，以“长期健康度/增量增强”为主；或
- **Go：直接启动 2.0 专项**（更强的破坏性变更治理与迁移演练）；或
- **No-Go：继续补中期缺口**（门禁/兼容/文档/打包证据不足）

## 当前建议

**Go（偏 Far Phase）**，前提是 M359/M360 的“最终门禁 + VSIX 证据”补齐后再确认。

## 必须满足（硬门槛）

- `npm run check:release` 通过
- `npm run gates:stable` 通过
- `npm run test:vscode` 至少一次通过（或在 CI 有证据）
- 产出 VSIX，并记录尺寸（对照 bundle budget）

## 风险与缓解

- **兼容性/自救不足**：按 `docs/PROTOCOL_COMPAT_SMOKE.md` 最小集回归
- **包体超预算**：按 `resources/BUNDLE_GOVERNANCE.md` 做裁剪
- **用户沟通不足**：补 `docs/IR_REMOVAL_FAQ_M348.md` 与支持剧本

