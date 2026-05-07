# 包体治理（扩展宿主）

## 原则

- **扩展入口包**（`dist/extension/index.js`）经 esbuild 打包；**不得**把 Puppeteer 浏览器二进制打进该包（`puppeteer` 为 **external**，运行时由依赖安装拉取 Chromium）。
- **Shiki / Mermaid**：作为 **npm 依赖** 供导出与 webview 构建使用；Rich 中可通过设置关闭 **Shiki** / **Mermaid** 以降低运行时负载。
- **门禁**：`npm run check:bundle`（`scripts/check_webview_bundle.mjs` + `scripts/check_extension_bundle.mjs`）限制宿主/ webview 的体积与 gzip；调阈值请同步评审。

## Budget（M313）

当前默认阈值（可用环境变量覆盖，CI 同步生效）：

### Extension bundle（`dist/extension/index.js`）

- `MARKLY_EXTENSION_MAX_BYTES`：默认 500KB
- `MARKLY_EXTENSION_MAX_GZIP_BYTES`：默认 180KB

实现：`scripts/check_extension_bundle.mjs`

### Webview dist（`dist/webview/`）

- `MARKLY_WEBVIEW_MAX_FILES`：默认 140
- `MARKLY_WEBVIEW_MAX_TOTAL_BYTES`：默认 18MB
- `MARKLY_WEBVIEW_MAX_BIGGEST_FILE_BYTES`：默认 11MB
- `MARKLY_WEBVIEW_MAX_BIGGEST_GZIP_BYTES`：默认 2.5MB（重点防 `shiki-vendor` / `mermaid-vendor` 回归）

实现：`scripts/check_webview_bundle.mjs`

## 策略摘要

| 依赖 | 策略 |
|------|------|
| Puppeteer | external；PDF 导出时按需启动 |
| Shiki | 依赖；Rich 默认关，可关 |
| Mermaid | 依赖；Rich 默认可关；导出内联脚本见导出管线 |

仓库脚本与 CI 以实际 `package.json` / `esbuild` 外部化为准。

## 体积趋势（可选）

发版或重大依赖变更后可在本地运行 **`npm run record:bundle-sizes`**，说明见 **[`BUNDLE_SIZE_HISTORY.md`](BUNDLE_SIZE_HISTORY.md)**。
