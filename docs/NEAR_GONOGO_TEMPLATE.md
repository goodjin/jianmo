# 近期阶段 Go/No-Go 自检模板（M268 / M270 / M275）

> 用途：在“近期封板/最终 Release Train”前做一次可重复自检，避免把风险带进下一阶段。

## 1. 基本信息

- 评审日期：
- 版本号（计划发布）：
- 评审人：

## 2. 自检清单（建议逐条粘贴证据）

- [ ] `npm run gates:stable` 通过（贴日志摘要或 CI 结论）
- [ ] `npm run check:release` 通过
- [ ] CI 已跑过 `npm run test:vscode`（headless e2e）并通过（见 `.github/workflows/ci.yml`）
- [ ] 近期主路径无已知 P0（Rich 启动白板/导出全挂/图片资产错乱）
- [ ] 导出失败诊断包可复制且能指导用户下一步（见 `resources/TROUBLESHOOTING.md`）
- [ ] `markly.export.preflight.*` 的行为与文档一致（见 `docs/EXPORT_GUIDE.md`）
- [ ] 近期新增的文档/模板链接可达（README / CONTRIBUTING / issue 模板）

## 3. 关键指标（可选）

- 导出成功率（主观/样本数）：  
- Rich 启动失败/超时率（主观/样本数）：  
- 支持工单量趋势（如有）：  

## 4. 决策

- [ ] **Go**：允许进入下一阶段（中期）或发布 Train
- [ ] **No-Go**：阻塞项如下（必须列出 owner + 截止时间）

| 阻塞项 | Owner | 截止 | 备注 |
|--------|-------|------|------|
| | | | |

