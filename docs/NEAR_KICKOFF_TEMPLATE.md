# 近期阶段 Kickoff 模板（M201）

> 用途：把“近期路线（M201–M275）”落到可执行的节奏与 owner。建议每次进入一个新阶段或新季度时填写一次。

## 1. 基本信息

- Kickoff 日期：
- 负责人（Owner）：
- 参与者：
- 目标版本区间（预计）：

## 2. 范围声明

- **本期必做**（列 3–7 条）：
  - 
- **本期不做**（列 3–7 条，防 scope creep）：
  - 

## 3. 风险与回滚

| 风险 | 触发信号 | 缓解 | 回滚方式 |
|------|----------|------|----------|
| | | | |

## 4. 门禁与证据

- 必跑：`npm run gates:stable`
- 发版前：`npm run check:release`
- CI：确认 `.github/workflows/ci.yml` 中包含 `test:vscode`（headless）与 bundle report

## 5. 迭代节奏（建议）

- 每周：1 次依赖/安全检查（见 `docs/DEPENDENCY_UPDATE_POLICY.md`）
- 每两周：1 次回归用例反哺（见 `docs/REGRESSION_PLAYBOOK.md`）
- 每次发版：手动追加一次包体趋势（见 `resources/BUNDLE_SIZE_HISTORY.md`）

