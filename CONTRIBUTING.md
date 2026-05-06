# 参与贡献

感谢你对 Markly 感兴趣。提交 PR 前请阅读 [`docs/IR_FREEZE_POLICY.md`](docs/IR_FREEZE_POLICY.md)（**IR 模式冻结**）与 [`.github/pull_request_template.md`](.github/pull_request_template.md)。

## 本地开发

```bash
npm install
cd webview && npm install && cd ..
```

构建：

```bash
npm run build
```

## 门禁（M248：建议 10 分钟内跑完）

```bash
npm run gates:stable
```

等价于：`lint` + `check:ir-freeze` + `test` + `build` + `check:bundle`。

GitHub Actions 的 **CI** 在上述基础上还会跑 **`npm run test:vscode`**（Linux + `xvfb-run`，见 `.github/workflows/ci.yml`）与 **`npm run record:bundle-sizes`**（仅写 `tmp/bundle-sizes.json`，不落库）。本地若跑集成测试：先 `npm run build`，再 `npm run test:vscode`；macOS 可用系统 VS Code，或通过环境变量指定 CLI：`MARKLY_VSCODE_EXECUTABLE_PATH=/path/to/code`。

## 发版路径额外检查

```bash
npm run check:release
```

校验根目录与 `webview/package.json` 的 **version** 一致、`CHANGELOG.md` 含当前版本标题等。若根目录存在多个历史 `.vsix`，可设 **`MARKLY_CHECK_VSIX=1`** 再运行以校验文件名与版本一致。

## 报告问题

请尽量使用 Issue 模板（[`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md)），并按 [`docs/REPRO_TEMPLATE.md`](docs/REPRO_TEMPLATE.md) 提供最短复现与诊断包。

## 路线图

阶段规划见 [`docs/ROADMAP_NEAR.md`](docs/ROADMAP_NEAR.md) / [`docs/ROADMAP_MID.md`](docs/ROADMAP_MID.md) / [`docs/ROADMAP_FAR.md`](docs/ROADMAP_FAR.md)。
