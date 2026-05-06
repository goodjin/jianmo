# E2E：最小 smoke suite（Rich/Source/导出/诊断）（M310）

## 目标

在 CI 中能稳定跑通最关键的用户旅程（最小集），用于“上线前的早期预警”：

- 打开 `.md` → Rich/Source 切换 → 编辑 → 保存
- 导出 PDF / HTML（含预检/失败诊断入口）
- 诊断信息可复制（用于工单自救）

## 当前仓库状态（已具备的基础）

- Webview 单测覆盖了大量关键交互（Rich 表格、find/replace、watchdog fallback、诊断包等）
- Extension 侧有 VS Code 集成测试入口：`npm run test:vscode`

## 建议的最小 smoke 套件结构（落地建议）

- `e2e/ui-suite/`（UI 路径，适合覆盖“真正能打开 VS Code 并操作”的流程）
- `e2e/index.js`（现有集成测试入口，用于稳定性更高的 API 级验证）

## 先行验收标准（本里程碑）

1. 本地可重复执行：
   - `npm run test:vscode`
2. 在 CI 能稳定跑（允许先从 API 集成测试起步，再逐步引入 UI-suite）。

