# 支持：常见问题剧本与排障收敛（M349）

## 目标

让支持/自己排障的路径收敛到“一个入口 + 一套信息”，减少来回问答。

## 统一入口

- **Recovery & Troubleshooting（自救中心）**：复制诊断信息
- 文档入口：`resources/TROUBLESHOOTING.md`

## 工单/Issue 必须信息（模板）

- VS Code 版本、OS
- Markly 版本
- 当前模式（Rich/Source）
- 是否在 Remote/WSL/容器
- 复现步骤（最少 3 步）
- **诊断信息**（从自救中心复制）

## 常见问题剧本（快速分流）

### A) 白屏/红屏/无法打开

- 先 `Developer: Reload Window`
- 仍不行：走 `docs/IR_REMOVAL_FAQ_M348.md` 的自救步骤

### B) 保存失败/内容丢失担忧

- 先看是否有 `SAVE_FAILED` 提示与诊断
- 建议临时切 Source 继续编辑（保证落盘）

### C) 导出失败

- 走 `docs/EXPORT_FAILURE_DIAGNOSTICS_UX_M324.md`
- 收集导出预检结果与诊断

### D) 快捷键不生效

- 走 `docs/SHORTCUT_CONFLICTS_FAQ_M329.md`

