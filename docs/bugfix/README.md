# Bugfix Sprint（M274）

本目录用于记录一次“高优问题 → 根因 → 修复 → 门禁 → 文档同步”的闭环，便于后续复盘与回归。

## 使用方式（建议）

1. 从 Issue 或用户反馈中选 1 个 **P0/P1**（见 `docs/SUPPORT_FLOW.md` 的分级）。
2. 先补最短复现与诊断证据（`docs/REPRO_TEMPLATE.md` + 复制诊断/导出诊断包）。
3. 修复后必须补齐门禁：
   - 至少 `npm test`
   - 影响主链路的，优先保证 `npm run gates:stable` 可重复通过
4. 若问题影响排障体验，同步更新 `resources/TROUBLESHOOTING.md`。

## 已归档条目

- `2026-04-30-rich-timeout-table-paste.md`

