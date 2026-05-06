# 包体治理（扩展宿主）

## 原则

- **扩展入口包**（`dist/extension/index.js`）经 esbuild 打包；**不得**把 Puppeteer 浏览器二进制打进该包（`puppeteer` 为 **external**，运行时由依赖安装拉取 Chromium）。
- **Shiki / Mermaid**：作为 **npm 依赖** 供导出与 webview 构建使用；Rich 中可通过设置关闭 **Shiki** / **Mermaid** 以降低运行时负载。
- **门禁**：`npm run check:bundle:extension`（`scripts/check_extension_bundle.mjs`）限制宿主 JS 体积与 gzip 体积；调阈值请同步评审。

## 策略摘要

| 依赖 | 策略 |
|------|------|
| Puppeteer | external；PDF 导出时按需启动 |
| Shiki | 依赖；Rich 默认关，可关 |
| Mermaid | 依赖；Rich 默认可关；导出内联脚本见导出管线 |

仓库脚本与 CI 以实际 `package.json` / `esbuild` 外部化为准。

## 体积趋势（可选）

发版或重大依赖变更后可在本地运行 **`npm run record:bundle-sizes`**，说明见 **[`BUNDLE_SIZE_HISTORY.md`](BUNDLE_SIZE_HISTORY.md)**。
