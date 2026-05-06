# 指标：质量/性能/稳定指标文档（M355）

## 目标

把“质量好不好”从主观感觉变成可量化的共识。

## 质量（Quality）

- 单测通过率：`npm test` 必须稳定通过
- 关键用例覆盖：见 `docs/E2E_SMOKE_SUITE_M310.md`

## 性能（Performance）

- 初始化（webviewInitMs）：关注 P50/P95（见 `docs/PERF_BASELINE_M312.md`）
- 大文档：查找/滚动/大纲刷新，超过预算则必须降级策略（见 M333/M334/M335）

## 稳定性（Reliability）

- 保存失败：`SAVE_FAILED` 计数（本地诊断）应接近 0
- 导出失败：按错误类型聚合（本地诊断）

## 采集口径

- 默认：本地诊断（不联网）
- 若未来引入远端聚合：严格遵守隐私策略（见 `docs/TELEMETRY_PRIVACY_REVIEW_M323.md`）

