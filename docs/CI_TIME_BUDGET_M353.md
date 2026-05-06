# CI：时间预算与稳定性指标（M353）

## 目标

让 CI 变成“可预期”的基础设施：

- 时间预算明确（慢了就报警/拆分）
- 稳定性指标明确（偶发失败可追踪）

## 时间预算（建议）

- `npm run lint`：< 1 min
- `npm test`（含 webview）：< 3 min
- `npm run build`：< 2 min
- `npm run check:bundle`：< 30 s
- `npm run check:release`：< 10 s
- `npm run preflight` 总计：< 8 min

## 稳定性指标（建议）

- 过去 30 次 CI：
  - preflight 通过率 ≥ 95%
  - `test:vscode`（若跑）通过率 ≥ 90%（允许少量 flake，但必须有追踪）

## 做法

- 任何 flake 必须：
  - 固定复现路径（最小复现）
  - 在文档或 issue 里记录“临时缓解/长期修复”

