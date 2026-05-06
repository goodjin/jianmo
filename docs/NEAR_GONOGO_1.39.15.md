# Near Phase Go/No-Go（记录）— 1.39.15（M268 / M275）

- 评审日期：2026-05-06
- 版本号（计划发布）：1.39.15
- 评审人：自动化记录（本仓库）
- git：`14687bd`

## 自检清单（证据）

- [x] `npm run gates:stable` 通过（含 lint / IR freeze / test / build / bundle check）
- [x] `npm run check:release` 通过（版本与 CHANGELOG 标题一致）
- [x] CI 覆盖：仓库已在 CI 中包含 `npm run test:vscode`（见 `.github/workflows/ci.yml` 与 `e2e/README.md`）
- [x] 近期主路径无已知 P0（Rich 启动失败可降级 Source，导出失败可复制诊断，图片资产链路可诊断/修复）
- [x] 导出失败诊断包可复制且可指导下一步（见 `resources/TROUBLESHOOTING.md`）
- [x] `markly.export.preflight.*` 行为与文档一致（见 `docs/EXPORT_GUIDE.md`）
- [x] 近期新增文档/模板链接可达（README / CONTRIBUTING / issue 模板 / roadmap）

## 决策

- [x] **Go**：允许进入 `docs/ROADMAP_MID.md`（中期）或进入 Release Train。

