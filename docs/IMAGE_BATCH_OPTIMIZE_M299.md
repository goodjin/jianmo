# 图片：批量优化/重压缩（M299）

## 目标

提供一个**可逆**的批量图片优化命令，用于减小仓库/包体中的图片体积（默认覆盖 `images/`）。

## 命令

```bash
npm run images:optimize
```

可指定目录：

```bash
node ./scripts/optimize-images.mjs images resources
```

## 可逆（备份）

每次运行会把原文件备份到：

- `tmp/image-opt-backup-<timestamp>/...`

如需回滚，直接把备份覆盖回原路径即可。

## 当前策略

- **PNG**：用 `@squoosh/cli` 的 `oxipng auto`（WASM）做体积优化（保持 `.png`）。
- **SVG**：不自动重写（避免格式化导致 diff 噪音/语义差异）；仅纳入备份与统计。

