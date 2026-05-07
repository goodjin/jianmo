# 依赖供应链 SBOM（M301，可选）

## 目的

输出当前构建所依赖的第三方包清单（SBOM），用于：

- 供应链审计/安全扫描
- 版本冻结后的可追溯性

## 命令

在仓库根目录运行：

```bash
npm run sbom:generate
```

## 输出

SBOM 会写入 `tmp/`（已在 `.gitignore` 中忽略），默认路径：

- `tmp/sbom/<timestamp>/sbom-root.cyclonedx.json`
- `tmp/sbom/<timestamp>/sbom-webview.cyclonedx.json`

格式：CycloneDX JSON（由 `npm sbom --json` 生成）。

## 说明

- 本仓库有两个依赖树（root + webview），因此生成两份 SBOM。
- 若需要把 SBOM 纳入发布制品（而非本地生成），建议在 CI 里单独归档为 artifact（另立里程碑）。

