# 交接：Far Phase 输入与未竟事项（M352）

## 已落地基线（可复用）

- 门禁聚合：`npm run preflight`
- 发布与回滚：`docs/RELEASE_PLAYBOOK_M316.md`
- 诊断与自救：`resources/TROUBLESHOOTING.md`
- i18n：`package.nls.json` / `package.nls.zh-cn.json`
- A11y：`docs/A11Y_BASELINE_M308.md`
- E2E：`docs/E2E_SMOKE_SUITE_M310.md`
- 包体治理：`resources/BUNDLE_GOVERNANCE.md`

## 未竟事项（按“影响面”排序）

- 合规：NOTICE/第三方许可逐条归档（见 `docs/THIRDPARTY_LICENSE_NOTICE_M337.md`）
- 性能：webview vendor（尤其 shiki）进一步拆分或延迟加载
- 回归：将 `docs/REGRESSION_MATRIX_MINSET_M339.md` 固化进 release 流程（每次发版必跑）

## 推荐 Far Phase 主题

- “大仓库/大文档”性能专项（backlinks/outline/assets 的预算与降级落地）
- 稳定性专项：更早发现保存/导出异常（本地聚合指标）

