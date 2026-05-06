# 工程：Node/依赖版本策略定稿（M328）

## 目标

让本仓库在本地、CI、打包环境里使用一致且可维护的 Node/依赖策略，减少“我这里能跑你那里不行”。

## 约定

- **CI Node 版本**：以 GitHub Actions 为准（见 `.github/workflows/ci.yml`），当前使用 Node 20。
- **本地开发建议**：优先对齐 CI Node 主版本（Node 20）。
- **依赖安装**：根与 `webview/` 都用 `npm ci`（锁文件为准）。

## 变更策略

- **小版本升级**：允许在不破坏兼容的情况下按需升级（见 `docs/DEPENDENCY_UPDATE_POLICY.md`）。
- **大版本升级**：必须：
  - 在 `CHANGELOG` 写明风险点与回滚策略
  - 跑 `gates:stable` + `test:vscode`
  - 关注 bundle budget（`resources/BUNDLE_GOVERNANCE.md`）

## 证据入口

- `npm run gates:stable`
- `npm run test:vscode`
- `npm run check:release`

