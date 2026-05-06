# 发布：中期 release playbook（回滚/兼容/门禁）（M316）

## 目标

把一次发布从“凭记忆”变成“按清单可重复”，并明确：

- 需要跑哪些门禁
- 发现问题如何回滚
- 兼容性风险点在哪里、如何自救

## 发布前（必做门禁）

1. **本地**
   - `npm test`
   - `npm run gates:stable`（lint + 单测 + build + bundle）
2. **CI**
   - GitHub Actions `CI` 绿灯（含 `test:vscode` smoke）
3. **版本与日志**
   - 根 `package.json` 与 `webview/package.json` 版本号一致（SemVer）
   - `CHANGELOG.md` 包含当前版本标题（`## [x.y.z]`）
   - `npm run check:release` 通过

## 打包

- `npm run package`（生成 `.vsix`）
- （可选）记录包体与 bundle 趋势：
  - `npm run record:bundle-sizes`

## 回滚策略（最小可行）

当发现严重回归（编辑无法打开、保存失败、导出全面失败）：

1. **优先回滚到上一版 VSIX**
2. **保留证据**
   - 导出失败：`Export: Copy Last Failure Diagnostics`
   - Webview：复制诊断信息（脱敏）
3. **快速止血**
   - 若回归点明确，优先出一个 patch 修复版（避免在主线堆积 hotfix）

## 兼容性与自救（对用户）

- Rich 启动失败会自动降级 Source，并提供：
  - 重试 Rich / 重载 Webview / 复制诊断信息
- 导出失败提供“复制诊断包”入口，便于 Issue 复现

参考：

- `resources/TROUBLESHOOTING.md`
- `docs/PROTOCOL_COMPAT_SMOKE.md`（兼容 smoke）

